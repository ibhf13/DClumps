import { Project } from "ts-morph";
import { DataClumpsList, SmellyFields } from "../utils/Interfaces";
import {
  exportNewFileData,
  filterBySmellyKeys,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";
import { refactorSmellyFields } from "./RefactoringSmellyFields";
import { toCamelCase } from "../utils/RefactorUtils";
import { getDataClumpsTypeWithKey } from "./UserInput";

const project = new Project();
export function createNewClassesUsingAnchorKeyForSmellyFields(
  dataClumpsList: DataClumpsList[],
  outputPath: string,
  key: string,
  userChoiceGroup: SmellyFields[]
) {
  const anchorSmellyMethod = getDataClumpsTypeWithKey(
    dataClumpsList,
    key,
    "smellyFields"
  ) as SmellyFields;
  createNewClassUsingAnchorKey(anchorSmellyMethod, userChoiceGroup, outputPath);

  project.saveSync();
}

export function createNewClassesFromKeyListForSmellyFields(
  smellyFieldGroup: SmellyFields[],
  outputPath: string
) {
  createNewClassUsingOptimum(smellyFieldGroup, outputPath);
  project.saveSync();
}

function createNewClassUsingAnchorKey(
  anchorFieldsClass: SmellyFields,
  smellyFieldsGroup: SmellyFields[],
  outputPath: string
) {
  let newClassName = getNewClassNameFromFieldGroup(anchorFieldsClass);
  const fileName = generateUniqueFileName(
    anchorFieldsClass.classInfo.className + "_" + newClassName,
    outputPath
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    anchorFieldsClass,
    outputPath
  );

  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    anchorFieldsClass.fieldInfo,
    outputPath
  );
  project.saveSync();

  refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);

  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function createNewClassUsingOptimum(
  smellyFieldsGroup: SmellyFields[],
  outputPath: string
) {
  const leastParameterFieldGroup =
    getFieldGroupWithLeastParameters(smellyFieldsGroup);
  let newClassName = getNewClassNameFromFieldGroup(leastParameterFieldGroup);
  const fileName = generateUniqueFileName(
    leastParameterFieldGroup.classInfo.className + "_" + newClassName,
    outputPath
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    leastParameterFieldGroup,
    outputPath
  );

  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    leastParameterFieldGroup.fieldInfo,
    outputPath
  );
  project.saveSync();

  refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);

  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function getFieldGroupWithLeastParameters(
  smellyFields: SmellyFields[]
): SmellyFields {
  return smellyFields!.reduce((leastFieldGroup, currentFieldGroup) => {
    return currentFieldGroup.fieldInfo.length < leastFieldGroup.fieldInfo.length
      ? currentFieldGroup
      : leastFieldGroup;
  });
}
//TODO: maybe can be extracted
function getNewClassNameFromFieldGroup(smellyFieldGroup: SmellyFields) {
  return smellyFieldGroup.fieldInfo
    .map((field) => toCamelCase(field.name))
    .join("");
}

function createAndGetNewClass(
  newClassName: string,
  fileName: string,
  smellyFieldGroup: SmellyFields,
  outputPath: string
) {
  const newClassDeclaration = initializeNewClass(
    fileName,
    newClassName,
    outputPath,
    project
  );
  generateClassVariables(smellyFieldGroup, newClassDeclaration);
  generateConstructor(smellyFieldGroup, newClassDeclaration);
  generateGettersAndSetters(smellyFieldGroup, newClassDeclaration);

  return newClassDeclaration;
}
