import { Project } from "ts-morph";
import { DataClumpsList, SmellyFields } from "../utils/Interfaces";
import {
  exportNewFileData,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";
import { refactorSmellyFields } from "./RefactoringSmellyFields";
import { toCamelCase } from "../utils/RefactorUtils";

const project = new Project();

export function createNewClassesFromSmellyFieldDataClumpsList(
  dataClumpsList: DataClumpsList[],
  outputPath: string
) {
  dataClumpsList.forEach((smellyFieldGroup) => {
    createNewClass(smellyFieldGroup, outputPath);
  });
  project.saveSync();
}

function createNewClass(smellyFieldGroup, outputPath: string) {
  const leastParameterFieldGroup =
    getFieldGroupWithLeastParameters(smellyFieldGroup);
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

  refactorSmellyFields(
    newClassInfo,
    leastParameterFieldGroup,
    smellyFieldGroup,
    project
  );

  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

function getFieldGroupWithLeastParameters(
  dataClumpsList: DataClumpsList
): SmellyFields {
  // Assuming smellyFieldGroup is not undefined
  return dataClumpsList.smellyFields!.reduce(
    (leastFieldGroup, currentFieldGroup) => {
      return currentFieldGroup.fieldInfo.length <
        leastFieldGroup.fieldInfo.length
        ? currentFieldGroup
        : leastFieldGroup;
    }
  );
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
