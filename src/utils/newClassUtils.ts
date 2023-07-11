import { ClassDeclaration, Project, Scope } from "ts-morph";
import { ParameterInfo, NewClassInfo, DataClumpsType } from "./Interfaces";
import { existsSync } from "fs";

export function generateUniqueFileName(
  baseName: string,
  outputPath: string
): string {
  let counter = 0;
  let fileName = `${baseName}.ts`;

  while (existsSync(`${outputPath}${fileName}`)) {
    counter++;
    fileName = `${baseName}${counter}.ts`;
  }

  return fileName;
}

export function initializeNewClass(
  fileName: string,
  className: string,
  outputPath: string,
  project: Project
) {
  const filePath = outputPath + fileName;
  const newClassFile = project.createSourceFile(filePath);
  return newClassFile.addClass({ name: className, isExported: true });
}

export function generateClassVariables(
  smellyGroup: DataClumpsType,
  newClassDeclaration: ClassDeclaration
) {
  if ("methodInfo" in smellyGroup) {
    // This is a SmellyMethods instance
    smellyGroup.methodInfo.parameters.forEach((param: ParameterInfo) => {
      newClassDeclaration.addProperty({
        name: param.name,
        type: param.type,
        scope: Scope.Private,
      });
    });
  } else if ("fieldInfo" in smellyGroup) {
    // This is a SmellyFields instance
    smellyGroup.fieldInfo.forEach((param: ParameterInfo) => {
      newClassDeclaration.addProperty({
        name: param.name,
        type: param.type,
        initializer: param.value ? `${param.value}` : "undefined",
        scope: Scope.Private,
      });
    });
  }
}

export function generateConstructor(
  smellyGroup: DataClumpsType,
  newClassDeclaration: ClassDeclaration
) {
  const constructorDeclaration = newClassDeclaration.addConstructor();

  let parameters: ParameterInfo[];
  if ("methodInfo" in smellyGroup) {
    // This is a SmellyMethods instance
    parameters = smellyGroup.methodInfo.parameters;
  } else if ("fieldInfo" in smellyGroup) {
    // This is a SmellyFields instance
    parameters = smellyGroup.fieldInfo;
  } else {
    return; // If it's neither SmellyMethods nor SmellyFields, skip this item
  }

  parameters.forEach((param: ParameterInfo, index: number) => {
    constructorDeclaration.addParameter({
      name: param.name,
      type: param.type,
      initializer:
        "fieldInfo" in smellyGroup && param.value
          ? `${param.value}`
          : undefined,
    });

    const statement = `this.${param.name} = ${param.name};`;

    if (index === 0) {
      constructorDeclaration.setBodyText(statement);
    } else {
      constructorDeclaration.addStatements(statement);
    }
  });
}

export function generateGettersAndSetters(
  smellyGroup: DataClumpsType,
  newClassDeclaration: ClassDeclaration
) {
  let parameters: ParameterInfo[];
  if ("methodInfo" in smellyGroup) {
    // This is a SmellyMethods instance
    parameters = smellyGroup.methodInfo.parameters;
  } else if ("fieldInfo" in smellyGroup) {
    // This is a SmellyFields instance
    parameters = smellyGroup.fieldInfo;
  } else {
    return; // If it's neither SmellyMethods nor SmellyFields, skip this item
  }

  parameters.forEach((param: ParameterInfo) => {
    const capitalizedParamName =
      param.name.charAt(0).toUpperCase() + param.name.slice(1);

    newClassDeclaration.addMethod({
      name: `get${capitalizedParamName}`,
      returnType: param.type,
      statements: `return this.${param.name};`,
    });

    newClassDeclaration.addMethod({
      name: `set${capitalizedParamName}`,
      parameters: [{ name: param.name, type: param.type }],
      statements: `this.${param.name} = ${param.name};`,
    });
  });
}

export function exportNewFileData(
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
