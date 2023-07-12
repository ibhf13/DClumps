import { ClassDeclaration, Project, Scope } from "ts-morph";
import {
  DataClumpsList,
  ParameterInfo,
  NewClassInfo,
  SmellyFields,
} from "../utils/Interfaces";
import { existsSync } from "fs";
import {
  exportNewFileData,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";
import { refactorSmellyFields } from "./RefactoringSmellyFields";

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
  return dataClumpsList.smellyFieldGroup!.reduce(
    (leastFieldGroup, currentFieldGroup) => {
      return currentFieldGroup.fieldInfo.length <
        leastFieldGroup.fieldInfo.length
        ? currentFieldGroup
        : leastFieldGroup;
    }
  );
}

function getNewClassNameFromFieldGroup(smellyFieldGroup: SmellyFields) {
  return smellyFieldGroup.fieldInfo
    .map((field) => field.name.charAt(0).toUpperCase() + field.name.slice(1))
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
