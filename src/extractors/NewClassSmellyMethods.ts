import { Project } from "ts-morph";
import { DataClumpsList, SmellyMethods } from "../utils/Interfaces";
import {
  refactorMethods,
  refactorMethodsUsingKey,
} from "./RefactoringSmellyMethods";
import {
  exportNewFileData,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";

const project = new Project();

function getSmellyMethodWithKey(
  dataClumpsList: DataClumpsList[],
  key: string
): SmellyMethods {
  const foundMethod = dataClumpsList
    .flatMap((data) => data.smellyMethods || [])
    .find((method) => method.key === key);
  return foundMethod || null;
}

export function createNewClassesUsingKey(
  dataClumpsList: DataClumpsList[],
  outputPath: string,
  allKeys: string[]
) {
  const anchorSmellyMethod = getSmellyMethodWithKey(dataClumpsList, allKeys[0]);
  createNewClass(anchorSmellyMethod, outputPath);
  project.saveSync();
}

export function createNewClassesFromDataClumpsList(
  smellyMethodGroup: SmellyMethods[],
  outputPath: string
) {
  createNewClassFromGroup(smellyMethodGroup, outputPath);

  project.saveSync();
}

function createNewClass(
  leastParameterMethod: SmellyMethods,
  outputPath: string
) {
  // const leastParameterMethod = getMethodWithLeastParameters(smellymethodGroup);
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
  //refactorMethodsUsingKey(newClassInfo, leastParameterMethod, project);
  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function createNewClassFromGroup(
  smellyMethodGroup: SmellyMethods[],
  outputPath: string
) {
  const leastParameterMethod = getMethodWithLeastParameters(smellyMethodGroup);
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
  // refactorMethods(
  //   newClassInfo,
  //   leastParameterMethod,
  //   smellyMethodGroup,
  //   project
  // );
  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function getMethodWithLeastParameters(
  SmellyMethodGroup: SmellyMethods[]
): SmellyMethods {
  return SmellyMethodGroup?.reduce((leastMethod, currentMethod) => {
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
