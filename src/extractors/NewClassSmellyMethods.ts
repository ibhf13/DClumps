import { Project } from "ts-morph";
import { DataClumpsList, SmellyMethods } from "../utils/Interfaces";
import { refactorSmellyMethods } from "./RefactoringSmellyMethods";
import {
  exportNewFileData,
  filterDataClumpsList,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";
import { getDataClumpsTypeWithKey } from "./UserInput";

const project = new Project();

export function createNewClassesUsingAnchorKeyForSmellyMethods(
  dataClumpsList: DataClumpsList[],
  outputPath: string,
  key: string,
  userChoiceGroup: SmellyMethods[]
) {
  const anchorSmellyMethod = getDataClumpsTypeWithKey(
    dataClumpsList,
    key,
    "smellyMethods"
  ) as SmellyMethods;
  createNewClassUsingAnchorKey(anchorSmellyMethod, outputPath, userChoiceGroup);

  project.saveSync();
}

export function createNewClassesFromKeyList(
  smellyMethodGroup: SmellyMethods[],
  outputPath: string
) {
  createNewClassFromGroup(smellyMethodGroup, outputPath);
  project.saveSync();
}

function createNewClassUsingAnchorKey(
  anchorSmellyMethodClass: SmellyMethods,
  outputPath: string,
  smellyMethodGroup: SmellyMethods[]
) {
  // const leastParameterMethod = getMethodWithLeastParameters(smellymethodGroup);
  let newClassName = getNewClassName(anchorSmellyMethodClass);
  const fileName = generateUniqueFileName(
    anchorSmellyMethodClass.classInfo.className + "_" + newClassName,
    outputPath
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    anchorSmellyMethodClass,
    outputPath
  );
  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    anchorSmellyMethodClass.methodInfo.parameters,
    outputPath
  );
  refactorSmellyMethods(newClassInfo, smellyMethodGroup, project);
  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function createNewClassFromGroup(
  smellyMethodGroup: SmellyMethods[],
  outputPath: string
) {
  const anchorSmellyMethodClass =
    getMethodWithLeastParameters(smellyMethodGroup);

  let newClassName = getNewClassName(anchorSmellyMethodClass);
  const fileName = generateUniqueFileName(
    anchorSmellyMethodClass.classInfo.className + "_" + newClassName,
    outputPath
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    anchorSmellyMethodClass,
    outputPath
  );
  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    anchorSmellyMethodClass.methodInfo.parameters,
    outputPath
  );
  refactorSmellyMethods(newClassInfo, smellyMethodGroup, project);
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
