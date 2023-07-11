import { ClassDeclaration, Project, Scope } from "ts-morph";
import {
  DataClumpsList,
  ParameterInfo,
  NewClassInfo,
  SmellyFields,
} from "../utils/Interfaces";
import { existsSync } from "fs";

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

function generateUniqueFileName(baseName: string, outputPath: string): string {
  let counter = 0;
  let fileName = `${baseName}.ts`;

  while (existsSync(`${outputPath}${fileName}`)) {
    counter++;
    fileName = `${baseName}${counter}.ts`;
  }

  return fileName;
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
    outputPath
  );
  generateClassVariables(smellyFieldGroup, newClassDeclaration);
  generateConstructor(smellyFieldGroup, newClassDeclaration);
  generateGettersAndSetters(smellyFieldGroup, newClassDeclaration);

  return newClassDeclaration;
}

function initializeNewClass(
  fileName: string,
  className: string,
  outputPath: string
) {
  const filePath = outputPath + fileName;
  const newClassFile = project.createSourceFile(filePath);
  return newClassFile.addClass({ name: className, isExported: true });
}

function generateClassVariables(
  smellyFieldGroup: SmellyFields,
  newClassDeclaration: ClassDeclaration
) {
  smellyFieldGroup.fieldInfo.forEach((field: ParameterInfo) => {
    newClassDeclaration.addProperty({
      name: field.name,
      type: field.type,
      initializer: field.value ? `${field.value}` : "undefined",
      scope: Scope.Private,
    });
  });
}

function generateConstructor(
  smellyFieldGroup: SmellyFields,
  newClassDeclaration: ClassDeclaration
) {
  const constructorDeclaration = newClassDeclaration.addConstructor();

  smellyFieldGroup.fieldInfo.forEach((field: ParameterInfo, index: number) => {
    constructorDeclaration.addParameter({
      name: field.name,
      type: field.type,
      initializer: field.value ? `${field.value}` : "undefined",
    });

    if (index === 0) {
      constructorDeclaration.setBodyText((writer) =>
        writer.write(`this.${field.name} = ${field.name};`)
      );
    } else {
      constructorDeclaration.addStatements((writer) =>
        writer.write(`this.${field.name} = ${field.name};`)
      );
    }
  });
}

function generateGettersAndSetters(
  smellyFieldGroup: SmellyFields,
  newClassDeclaration: ClassDeclaration
) {
  smellyFieldGroup.fieldInfo.forEach((field: ParameterInfo) => {
    const capitalizedFieldName =
      field.name.charAt(0).toUpperCase() + field.name.slice(1);

    newClassDeclaration.addMethod({
      name: `get${capitalizedFieldName}`,
      returnType: field.type,
      statements: `return this.${field.name};`,
    });

    newClassDeclaration.addMethod({
      name: `set${capitalizedFieldName}`,
      parameters: [{ name: field.name, type: field.type }],
      statements: `this.${field.name} = ${field.name};`,
    });
  });
}

function exportNewFileData(
  newClassDeclaration: ClassDeclaration,
  fileName: string,
  parameters: ParameterInfo[],
  outputPath: string
): NewClassInfo {
  const filePath = outputPath + fileName;
  return {
    className: newClassDeclaration.getName(),
    filepath: filePath,
    parameters: parameters,
  };
}
