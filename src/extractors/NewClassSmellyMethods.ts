import { Project } from "ts-morph";
import { DataClumpsList, SmellyMethods } from "../utils/Interfaces";
import { refactorMethods } from "./DataclumpsRefactoring";
import {
  exportNewFileData,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";

const project = new Project();

export function createNewClassesFromDataClumpsList(
  dataClumpsList: DataClumpsList[],
  outputPath: string
) {
  dataClumpsList.forEach((smellymethodGroup) => {
    createNewClass(smellymethodGroup, outputPath);
  });

  project.saveSync();
}

function createNewClass(smellymethodGroup, outputPath: string) {
  const leastParameterMethod = getMethodWithLeastParameters(smellymethodGroup);
  let newClassName = getNewClassName(leastParameterMethod);
  const fileName = generateUniqueFileName(
    leastParameterMethod.classInfo.className + "_" + newClassName,
    outputPath
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    leastParameterMethod,
    outputPath
  );
  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    leastParameterMethod.methodInfo.parameters,
    outputPath
  );
  refactorMethods(
    newClassInfo,
    leastParameterMethod,
    smellymethodGroup,
    project
  );
  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function getMethodWithLeastParameters(
  dataClumpsList: DataClumpsList
): SmellyMethods {
  // Assuming dataClumpsList.smellyMethods is not undefined
  return dataClumpsList.smellyMethods!.reduce((leastMethod, currentMethod) => {
    return currentMethod.methodInfo.parameters.length <
      leastMethod.methodInfo.parameters.length
      ? currentMethod
      : leastMethod;
  });
}

function getNewClassName(leastParameterMethod: SmellyMethods) {
  return leastParameterMethod.methodInfo.parameters
    .map(
      (parameter) =>
        parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    )
    .join("");
}

function createAndGetNewClass(
  newClassName: string,
  fileName: string,
  leastParameterMethod: SmellyMethods,
  outputPath: string
) {
  const newClassDeclaration = initializeNewClass(
    fileName,
    newClassName,
    outputPath,
    project
  );
  generateClassVariables(leastParameterMethod, newClassDeclaration);
  generateConstructor(leastParameterMethod, newClassDeclaration);
  generateGettersAndSetters(leastParameterMethod, newClassDeclaration);

  return newClassDeclaration;
}
