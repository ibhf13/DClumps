import {
  ClassDeclaration,
  ParameterDeclaration,
  Project,
  ReferenceFindableNode,
  SyntaxKind,
} from "ts-morph";
import {
  ClassInfo,
  MethodInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyMethods,
  GlobalCalls,
} from "../utils/Interfaces";
import { writeFileSync } from "fs";
import { createNewClassesFromDataClumpsList } from "./extractNewClasses";

let codeAnalyzerProject = new Project();
let smellyMethodGroup: SmellyMethods[] = [];
let Data_Clumps_List: DataClumpsList[] = [];
const MIN_MATCHES = 2;

const projectDirectory = "./src";
codeAnalyzerProject.addSourceFilesAtPaths(`${projectDirectory}/**/*.ts`);

function projectFileList(): string[] {
  let project = new Project();
  project.addSourceFilesAtPaths("./src/**/*.ts");

  return project.getSourceFiles().map((file) => file.getFilePath());
}

function analyzeProjectFiles() {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    // Analysis of classes
    let classesInFile = file.getClasses();
    classesInFile.forEach((cls) => {
      const methods = cls.getMethods();
      methods.forEach((method) => {
        compareMethodsWithOtherFiles(method, cls, file.getFilePath());
        //compareWithParentClassMethods(method, cls, file.getFilePath());
      });
    });

    if (smellyMethodGroup.length > 1) {
      console.log(
        `Detected ${
          smellyMethodGroup.length
        } smelly methods in file: ${file.getFilePath()}`
      );
      Data_Clumps_List.push({
        smellyMethods: [...smellyMethodGroup],
      });
      smellyMethodGroup = [];
    }
  });
}

function compareMethodsWithOtherFiles(method, clazz, filepath) {
  const projectFiles = projectFileList();
  let matchFound = false;

  projectFiles.forEach((filePath) => {
    matchFound = compareWithOtherClasses(method, filePath, matchFound);
  });

  storeSmellyMethods(matchFound, method, clazz, filepath);
}

function compareWithOtherClasses(method, filePath, matchFound) {
  const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
  const classesInFile = sourceFile.getClasses();

  classesInFile.forEach((otherClass) => {
    matchFound = findMatchingMethods(method, otherClass, filePath, matchFound);
  });

  return matchFound;
}

function findMatchingMethods(method, otherClass, filePath, matchFound) {
  const otherMethods = otherClass.getMethods();

  otherMethods.forEach((otherMethod) => {
    if (otherMethod !== method) {
      const otherMethodParameters = otherMethod.getParameters();

      if (otherMethodParameters.length > 2) {
        const methodParameters = method.getParameters();
        if (doParametersMatch(methodParameters, otherMethodParameters)) {
          matchFound = true;
          if (
            !isMethodInDataClumpsList(
              otherMethod.getName(),
              otherClass.getName()
            ) &&
            !isMethodInSmellymethodGroup(
              otherMethod.getName(),
              otherClass.getName(),
              filePath
            )
          ) {
            storeMethodInfo(otherMethod, otherClass, filePath);
          }
        }
      }
    }
  });

  return matchFound;
}
function doParametersMatch(params1, params2) {
  let matchMap = new Map();

  for (let param1 of params1) {
    for (let param2 of params2) {
      if (
        param1.getName() === param2.getName() &&
        param1.getType().getText() === param2.getType().getText()
      ) {
        let matchKey = param1.getName() + param1.getType().getText();
        matchMap.set(matchKey, (matchMap.get(matchKey) || 0) + 1);
      }
    }
  }

  let matchCount = 0;
  for (let count of matchMap.values()) {
    matchCount += count;
    if (matchCount >= MIN_MATCHES) return true;
  }

  return false;
}
//TODO handle if parameter intersection it not the same
function isMethodInDataClumpsList(methodName, className) {
  return Data_Clumps_List.some((dataClump) =>
    dataClump.smellyMethods.some(
      (smellyMethod) =>
        smellyMethod.methodInfo.methodName === methodName &&
        smellyMethod.classInfo.className === className
    )
  );
}

function isMethodInSmellymethodGroup(methodName, className, filePath) {
  return smellyMethodGroup.some(
    (smellyMethod) =>
      smellyMethod.methodInfo.methodName === methodName &&
      smellyMethod.classInfo.className === className
  );
}

function storeSmellyMethods(matchFound, method, clazz, filepath) {
  if (
    matchFound &&
    !isMethodInDataClumpsList(method.getName(), clazz.getName())
  ) {
    storeMethodInfo(method, clazz, filepath);
  }
}
function storeMethodInfo(method, clazz, filepath) {
  const parametersOfMethod = method.getParameters();

  // Don't store the method if it has no parameters
  if (parametersOfMethod.length === 0) {
    return;
  }

  const parameterInformation: ParameterInfo[] = parametersOfMethod.map(
    (param: ParameterDeclaration) => ({
      name: param.getName(),
      type: param.getType().getText(),
      value: param.getInitializer()?.getText(),
    })
  );

  const methodDetails: MethodInfo = {
    methodName: method.getName(),
    parameters: parameterInformation,
  };

  const classDetails: ClassInfo = {
    className: clazz.getName() || "",
    filepath,
  };

  const smellyMethod: SmellyMethods = {
    methodInfo: methodDetails,
    classInfo: classDetails,
    callsList: {
      callsInSame: 0,
      callsGlob: [],
    },
    callsCount: 0,
  };

  analyzeMethodReferences(smellyMethod, method, clazz);

  smellyMethodGroup.push(smellyMethod);
}

function countCallsInSameClass(references, clazz: ClassDeclaration): number {
  let callsInSameClass = 0;

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass) continue; // The reference might not be inside a class (it could be in a function or a variable, for example)

    const isSameClass = refClass.getName() === clazz.getName();
    if (isSameClass) callsInSameClass++;
  }

  return callsInSameClass;
}

function getGlobalCalls(references, clazz: ClassDeclaration): GlobalCalls[] {
  let globalCalls: GlobalCalls[] = [];

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass || refClass.getName() === clazz.getName()) continue;

    let foundGlobalCall = globalCalls.find(
      (call) =>
        call.classInfo.className === refClass.getName() &&
        call.classInfo.filepath === refClass.getSourceFile().getFilePath()
    );

    if (foundGlobalCall) {
      foundGlobalCall.callsGlobCount++;
    } else {
      globalCalls.push({
        classInfo: {
          className: refClass.getName() || "",
          filepath: refClass.getSourceFile().getFilePath(),
        },
        callsGlobCount: 1,
      });
    }
  }

  return globalCalls;
}

function analyzeMethodReferences(
  smellyMethod: SmellyMethods,
  method: ReferenceFindableNode,
  clazz: ClassDeclaration
) {
  const references = method.findReferencesAsNodes();

  const callsInSameClass = countCallsInSameClass(references, clazz);
  const globalCalls = getGlobalCalls(references, clazz);

  smellyMethod.callsList = {
    callsInSame: callsInSameClass,
    callsGlob: globalCalls,
  };
  smellyMethod.callsCount = references.length;
}

//TODO handling interfaces
function doesClassImplementItsInterfaces(clazz) {
  const interfaces = clazz.getInterfaces();

  for (let iface of interfaces) {
    const interfaceMethods = iface.getMethods();

    for (let interfaceMethod of interfaceMethods) {
      const correspondingClassMethod = clazz.getMethod(
        interfaceMethod.getName()
      );

      if (!correspondingClassMethod) {
        console.error(
          `Class ${clazz.getName()} does not implement method ${interfaceMethod.getName()} from interface ${iface.getName()}.`
        );
        return false;
      }

      const interfaceParameters = interfaceMethod.getParameters();
      const classMethodParameters = correspondingClassMethod.getParameters();

      if (interfaceParameters.length !== classMethodParameters.length) {
        console.error(
          `Method ${interfaceMethod.getName()} in class ${clazz.getName()} does not have the correct number of parameters for interface ${iface.getName()}.`
        );
        return false;
      }

      for (let i = 0; i < interfaceParameters.length; i++) {
        if (
          interfaceParameters[i].getType().getText() !==
          classMethodParameters[i].getType().getText()
        ) {
          console.error(
            `Parameter ${interfaceParameters[
              i
            ].getName()} in method ${interfaceMethod.getName()} of class ${clazz.getName()} does not have the correct type for interface ${iface.getName()}.`
          );
          return false;
        }
      }
    }
  }

  return true;
}
//TODO handling inhiratence
function compareWithParentClassMethods(method, clazz, filePath) {
  let matchFound = false;

  // Check if the class has a base class
  if (clazz.getBaseClass()) {
    const baseClass = clazz.getBaseClass();

    const baseClassMethods = baseClass.getMethods();

    baseClassMethods.forEach((baseMethod) => {
      if (baseMethod.getName() !== method.getName()) {
        return; // Skip method if names are different
      }

      const baseMethodParameters = baseMethod.getParameters();

      if (baseMethodParameters.length > 2) {
        const methodParameters = method.getParameters();
        if (doParametersMatch(methodParameters, baseMethodParameters)) {
          matchFound = true; // Set matchFound flag to true

          if (
            !isMethodInDataClumpsList(
              baseMethod.getName(),
              baseClass.getName()
            ) &&
            !isMethodInSmellymethodGroup(
              baseMethod.getName(),
              baseClass.getName(),
              filePath
            )
          ) {
            storeMethodInfo(
              baseMethod,
              baseClass,
              baseClass.getSourceFile().getFilePath()
            );
          }
        }
      }
    });

    // Store the original method if a match was found and it is not already in the smellyMethodGroup
    if (
      matchFound &&
      !isMethodInDataClumpsList(method.getName(), clazz.getName())
    ) {
      storeMethodInfo(method, clazz, filePath);
    }
  }
}
analyzeProjectFiles();
createNewClassesFromDataClumpsList(Data_Clumps_List);

console.log(`found ${Data_Clumps_List.length} Dataclumps`);

writeFileSync(
  "./src/output/jsonDclumps/Data_Clumps_List.json",
  JSON.stringify(Data_Clumps_List, null, 2)
);
