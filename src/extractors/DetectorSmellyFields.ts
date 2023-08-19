import {
  ClassDeclaration,
  MethodDeclaration,
  Node,
  ParameterDeclaration,
  Project,
  PropertyDeclaration,
  ReferenceFindableNode,
  SyntaxKind,
} from "ts-morph";
import {
  ClassInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyFields,
  GlobalCalls,
  SmellyMethods,
  MethodInfo,
} from "../utils/Interfaces";
import { doParametersMatch, projectFileList } from "../utils/DetectionsUtils";

let smellyFieldGroup: SmellyFields[] = [];
let smellyMethodGroup: SmellyMethods[] = [];
let Data_Clumps_List: DataClumpsList[] = [];

function addMetaInfo() {
  const metaInfo = {
    numberOfDataClumpsGroups: Data_Clumps_List.length,

    totalNumberOfSmellyFields: Data_Clumps_List.reduce(
      (total, clump) => total + (clump.smellyFields?.length || 0),
      0
    ),
    totalNumberOfSmellyMethods: Data_Clumps_List.reduce(
      (total, clump) => total + (clump.smellyMethods?.length || 0),
      0
    ),
  };

  Data_Clumps_List.unshift({
    metaInfo,
  });
}

export function DetectSmellyFields(
  codeAnalyzerProject: Project,
  toAnalyzeProjectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
): DataClumpsList[] {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    let classesInFile = file.getClasses();

    classesInFile.forEach((cls) => {
      const fields = cls.getProperties();
      const methods = cls.getMethods();
      compareFieldsWithOtherFiles(
        codeAnalyzerProject,
        fields,
        toAnalyzeProjectFolder,
        minDataClumps,
        excludeFolders
      );

      // const methods = cls.getMethods();
      methods.forEach((method) => {
        // Skip if method is a constructor for speed
        if (method.getName() === "__constructor") return;
        compareMethodsWithOtherFiles(
          codeAnalyzerProject,
          method,
          toAnalyzeProjectFolder,
          minDataClumps,
          excludeFolders
        );
      });
    });
    if (smellyFieldGroup.length > 1) {
      Data_Clumps_List.push({
        smellyFields: [...smellyFieldGroup],
      });
      smellyFieldGroup = [];
    } else if (smellyMethodGroup.length > 1) {
      Data_Clumps_List.push({
        smellyMethods: [...smellyMethodGroup],
      });
      smellyMethodGroup = [];
    }
  });

  addMetaInfo();
  setSmellyFieldKeys(Data_Clumps_List);
  setSmellyMethodKeys(Data_Clumps_List);

  return Data_Clumps_List;
}
function compareMethodsWithOtherFiles(
  codeAnalyzerProject: Project,
  method: MethodDeclaration,
  projectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
) {
  const projectFiles = projectFileList(projectFolder, excludeFolders);
  let matchFound = false;

  projectFiles.forEach((filePath) => {
    const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
    const classesInFile = sourceFile.getClasses();
    classesInFile.forEach((otherClass) => {
      matchFound = findMatchingParameters(
        method,
        otherClass,
        filePath,
        matchFound,
        minDataClumps
      );
    });
  });
}

function setSmellyFieldKeys(Data_Clumps_List: DataClumpsList[]) {
  Data_Clumps_List.forEach((dataClump, groupIndex) => {
    dataClump.smellyFields?.forEach((smellyField, fieldIndex) => {
      smellyField.key = `${groupIndex}${fieldIndex + 1}`;
    });
  });
}

function setSmellyMethodKeys(Data_Clumps_List: DataClumpsList[]) {
  Data_Clumps_List.forEach((dataClump, groupIndex) => {
    dataClump.smellyMethods?.forEach((smellyMethod, fieldIndex) => {
      smellyMethod.key = `${groupIndex}${fieldIndex + 1}`;
    });
  });
}

function compareFieldsWithOtherFiles(
  codeAnalyzerProject: Project,
  fields: PropertyDeclaration[],
  projectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
) {
  const projectFiles = projectFileList(projectFolder, excludeFolders);
  let matchFound = false;

  projectFiles.forEach((file) => {
    const sourceFile = codeAnalyzerProject.getSourceFile(file);
    const classesInFile = sourceFile.getClasses();

    classesInFile.forEach((otherClass) => {
      matchFound = findMatchingFields(
        fields,
        otherClass,
        file,
        matchFound,
        minDataClumps
      );
    });
  });
}

function findMatchingParameters(
  method: MethodDeclaration,
  otherClass: ClassDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
): boolean {
  const otherMethods = otherClass.getMethods();

  otherMethods.forEach((otherMethod) => {
    if (otherMethod !== method) {
      const otherMethodParams = otherMethod.getParameters();
      if (otherMethodParams.length >= minDataClumps) {
        const methodParameters = method?.getParameters();
        // console.log(
        //   "----------------------------",
        //   methodParameters[0].getText()
        // );
        if (
          doParametersMatch(methodParameters, otherMethodParams, minDataClumps)
        ) {
          matchFound = true;
          if (
            !existInDataClumpsList(
              otherMethod.getName(),
              otherClass.getName()
            ) &&
            !existInSmellyMethodGroup(
              otherMethod.getName(),
              otherClass.getName()
            )
          ) {
            storeSmellyMethodInfo(otherMethod, otherClass, filePath);
          }
        }
      }
    }
  });

  return matchFound;
}
function findMatchingFields(
  fields: PropertyDeclaration[],
  otherClass: ClassDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
): boolean {
  const otherFields: PropertyDeclaration[] = otherClass.getProperties();

  if (otherFields.length >= minDataClumps) {
    if (doParametersMatch(fields, otherFields, minDataClumps)) {
      matchFound = true;

      if (
        !existInDataClumpsList(filePath, otherClass.getName()) &&
        !existInSmellyFieldGroup(filePath, otherClass.getName())
      ) {
        storeFieldInfo(otherFields, otherClass, filePath);
      }
    }
  }

  return matchFound;
}

function existInDataClumpsList(
  filepath: string,
  className: string,
  methodName?: string
): boolean {
  for (const dataClump of Data_Clumps_List) {
    if (dataClump.smellyFields) {
      const foundField = dataClump.smellyFields.find(
        (field) =>
          field.classInfo.filepath === filepath &&
          field.classInfo.className === className
      );

      if (foundField) return true;
    } else if (dataClump.smellyMethods) {
      const foundMethod = dataClump.smellyMethods.find(
        (method) =>
          method.classInfo.className === className &&
          method.methodInfo.methodName === methodName
      );

      if (foundMethod) return true;
    }
  }
  return false;
}

function existInSmellyFieldGroup(filepath: string, className: string): boolean {
  return smellyFieldGroup.some(
    (smellyField) =>
      smellyField.classInfo.filepath === filepath &&
      smellyField.classInfo.className === className
  );
}
function existInSmellyMethodGroup(methodName: string, className: string) {
  return smellyMethodGroup.some(
    (smellyMethod) =>
      smellyMethod.methodInfo.methodName === methodName &&
      smellyMethod.classInfo.className === className
  );
}

function storeFieldInfo(
  fields: PropertyDeclaration[],
  clazz: ClassDeclaration,
  filepath: string
) {
  const fieldDetails: ParameterInfo[] = fields.map(
    (fieldVariable: PropertyDeclaration) => {
      let fieldType = fieldVariable.getType().getText();

      if (fieldType.includes("import")) {
        const typeParts = fieldType.split(".");
        const simpleTypeName = typeParts[typeParts.length - 1];
        return {
          scoop: fieldVariable.getScope(),
          name: fieldVariable.getName(),
          type: simpleTypeName,
        };
      }

      return {
        scoop: fieldVariable.getScope(),
        name: fieldVariable.getName(),
        type: fieldVariable.getType().getText(),
        value: fieldVariable.getInitializer()?.getText(),
      };
    }
  );

  const classDetails: ClassInfo = {
    className: clazz.getName() || "",
    filepath,
  };

  const smellyField: SmellyFields = {
    key: "0",
    fieldInfo: fieldDetails,
    classInfo: classDetails,
    callsInfo: {
      callsList: {
        callsInSame: 0,
        callsGlob: [],
      },
      callsCount: 0,
    },
  };

  analyzeFieldReferences(smellyField, fields, clazz);

  smellyFieldGroup.push(smellyField);
}

function countFieldReferencesInSameClass(
  references: Node[],
  clazz: ClassDeclaration
): number {
  const referencedClasses: string[] = [];

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass) continue;

    const isSameClass = refClass.getName() === clazz.getName();
    if (isSameClass) {
      const className = refClass.getName();
      if (!referencedClasses.includes(className)) {
        referencedClasses.push(className);
      }
    }
  }

  return referencedClasses.length;
}

function getGlobalFieldReferences(
  references: Node[],
  clazz: ClassDeclaration
): GlobalCalls[] {
  let globalCalls: GlobalCalls[] = [];
  const referencedClasses = new Map<string, ClassInfo>();

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass || refClass.getName() === clazz.getName()) continue;

    const key = refClass.getName() || refClass.getSourceFile().getFilePath();
    if (referencedClasses.has(key)) continue;

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

    referencedClasses.set(key, {
      className: refClass.getName() || "",
      filepath: refClass.getSourceFile().getFilePath(),
    });
  }

  return globalCalls;
}

function analyzeFieldReferences(
  smellyField: SmellyFields,
  fields: PropertyDeclaration[],
  clazz: ClassDeclaration
) {
  let references: Node[] = [];

  fields.forEach((field) => {
    references = references.concat(field.findReferencesAsNodes());
  });

  const callsInSameClass = countFieldReferencesInSameClass(references, clazz);
  const globalCalls = getGlobalFieldReferences(references, clazz);

  let totalCallsGlobCount = 0;
  globalCalls.forEach((call) => {
    totalCallsGlobCount += call.callsGlobCount;
  });

  smellyField.callsInfo.callsList = {
    callsInSame: callsInSameClass,
    callsGlob: globalCalls,
  };

  smellyField.callsInfo.callsCount = callsInSameClass + totalCallsGlobCount;
}

function storeSmellyMethodInfo(
  method: MethodDeclaration,
  clazz: ClassDeclaration,
  filepath: string
) {
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
    key: "0",
    methodInfo: methodDetails,
    classInfo: classDetails,
    callsInfo: {
      callsList: {
        callsInSame: 0,
        callsGlob: [],
      },
      callsCount: 0,
    },
  };

  analyzeSmellyMethodReferences(smellyMethod, method, clazz);

  smellyMethodGroup.push(smellyMethod);
}

function countSmellyMethodCallsInSameClass(
  references: Node[],
  clazz: ClassDeclaration
): number {
  let callsInSameClass = 0;

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass) continue; // The reference might not be inside a class (it could be in a function or a variable, for example)

    const isSameClass = refClass.getName() === clazz.getName();
    if (isSameClass) callsInSameClass++;
  }

  return callsInSameClass;
}

function getSmellyMethodGlobalCalls(
  references: Node[],
  clazz: ClassDeclaration
): GlobalCalls[] {
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

function analyzeSmellyMethodReferences(
  smellyMethod: SmellyMethods,
  method: ReferenceFindableNode,
  clazz: ClassDeclaration
) {
  const references = method.findReferencesAsNodes();

  const callsInSameClass = countSmellyMethodCallsInSameClass(references, clazz);
  const globalCalls = getSmellyMethodGlobalCalls(references, clazz);

  smellyMethod.callsInfo.callsList = {
    callsInSame: callsInSameClass,
    callsGlob: globalCalls,
  };
  smellyMethod.callsInfo.callsCount = references.length;
}
