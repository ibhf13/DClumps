import { ParameterDeclaration, Project } from "ts-morph";
import {
  ClassInfo,
  MethodInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyMethods,
} from "../utils/Interfaces";
import { writeFileSync } from "fs";

let codeAnalyzerProject = new Project();
let smellymethodGroup: SmellyMethods[] = [];
let Data_Clumps_List: DataClumpsList[] = [];

// Load project files
codeAnalyzerProject.addSourceFilesAtPaths("src/**/*.ts");

function analyzeProjectFiles() {
  const sourceFiles = codeAnalyzerProject.getSourceFiles();

  // Process each source file
  sourceFiles.forEach((file) => {
    const classesInFile = file.getClasses();

    // Analyze methods in each class of the file
    classesInFile.forEach((clazz) => {
      console.log("checking the firct class : ", clazz.getName());

      analyzeMethodsInClass(clazz, file.getFilePath());
    });

    // If smellymethodGroup has more than one element
    if (smellymethodGroup.length > 1) {
      console.log(
        `Detected ${
          smellymethodGroup.length
        } smelly methods in file: ${file.getFilePath()}`
      );
      Data_Clumps_List.push({ smellyMethods: [...smellymethodGroup] });
      smellymethodGroup = [];
    }
  });
}

function analyzeMethodsInClass(clazz, filepath) {
  const methodsInClass = clazz.getMethods();

  methodsInClass.forEach((method) => {
    const parametersOfMethod = method.getParameters();
    if (parametersOfMethod.length > 2) {
      // Skip the method if it already exists in Data_Clumps_List
      if (!isMethodInDataClumpsList(method.getName(), clazz.getName())) {
        storeMethodInfo(method, clazz, filepath);
        //console.log("Saving the first method ", method.getName());
      }
    }

    // Check other methods in the same class
    methodsInClass.forEach((otherMethod) => {
      if (otherMethod !== method) {
        const otherMethodParameters = otherMethod.getParameters();
        if (otherMethodParameters.length > 2) {
          if (doParametersMatch(parametersOfMethod, otherMethodParameters)) {
            // If otherMethod not in smellymethodGroup
            if (
              !isMethodInSmellymethodGroup(
                otherMethod.getName(),
                clazz.getName()
              )
            ) {
              storeMethodInfo(otherMethod, clazz, filepath);
            }
          }
        }
      }
    });
  });
}

function storeMethodInfo(method, clazz, filepath) {
  const parametersOfMethod = method.getParameters();
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
    callsInfo: {
      // callsInfo is now an object
      callsList: {
        callsInSame: 0,
        callsGlob: [],
      },
      callsCount: 0,
    },
  };

  smellymethodGroup.push(smellyMethod);
}

function isMethodInDataClumpsList(methodName, className) {
  return Data_Clumps_List.some((dataClump) =>
    dataClump.smellyMethods.some(
      (smellyMethod) =>
        smellyMethod.methodInfo.methodName === methodName &&
        smellyMethod.classInfo.className === className
    )
  );
}

function isMethodInSmellymethodGroup(methodName, className) {
  return smellymethodGroup.some(
    (smellyMethod) =>
      smellyMethod.methodInfo.methodName === methodName &&
      smellyMethod.classInfo.className === className
  );
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
    if (matchCount >= 3) return true;
  }

  return false;
}

// Start the analysis
analyzeProjectFiles();

console.log(`found ${Data_Clumps_List.length} Dataclumps`);

writeFileSync(
  "./Data_Clumps_List.json",
  JSON.stringify(Data_Clumps_List, null, 2)
);
