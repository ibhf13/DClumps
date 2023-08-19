import { ClassDeclaration, Project, Scope } from "ts-morph";
import {
  ParameterInfo,
  NewClassInfo,
  DataClumpsList,
  SmellyFields,
  SmellyMethods,
} from "./Interfaces";
import { existsSync } from "fs";
import { getSmellyType } from "../extractors/UserInput";

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
  parameters: ParameterInfo[],
  newClassDeclaration: ClassDeclaration
) {
  parameters.forEach((param: ParameterInfo) => {
    newClassDeclaration.addProperty({
      name: param.name,
      type: param.type,
      scope: Scope.Private,
    });
  });
}

export function generateConstructor(
  parameters: ParameterInfo[],
  newClassDeclaration: ClassDeclaration
) {
  const constructorDeclaration = newClassDeclaration.addConstructor();

  parameters.forEach((param: ParameterInfo, index: number) => {
    constructorDeclaration.addParameter({
      name: param.name,
      type: param.type,
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
  parameters: ParameterInfo[],
  newClassDeclaration: ClassDeclaration
) {
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

export function removeMetaInfo(
  dataClumpsList: DataClumpsList[]
): DataClumpsList[] {
  dataClumpsList.shift();
  return dataClumpsList;
}

export function filterDataClumpsList(
  dataClumpsList: DataClumpsList[],
  keyList: string[]
): (SmellyFields | SmellyMethods)[] {
  let result: (SmellyFields | SmellyMethods)[] = [];

  dataClumpsList.forEach((dataClump) => {
    if (dataClump.smellyMethods) {
      dataClump.smellyMethods.forEach((smellyMethod) => {
        if (keyList.includes(smellyMethod.key)) {
          result.push(smellyMethod);
        }
      });
    }

    if (dataClump.smellyFields) {
      dataClump.smellyFields.forEach((smellyField) => {
        if (keyList.includes(smellyField.key)) {
          result.push(smellyField);
        }
      });
    }
  });

  return result;
}

// export function xxx(
//   dataClumpsList: DataClumpsList[],
//   keyList: string[],
//   type: "smellyMethods" | "smellyFields"
// ): DataClumpsType[] {
//   if (type === "smellyMethods") {
//     return dataClumpsList.flatMap((dataClump) =>
//       (dataClump?.smellyMethods).filter((method) =>
//         keyList.includes(method.key)
//       )
//     );
//   } else {
//     return dataClumpsList.flatMap((dataClump) =>
//       (dataClump?.smellyFields).filter((field) => keyList.includes(field.key))
//     );
//   }
// }

export function filterBySmellyKeys(
  dataClumpsList: DataClumpsList[],
  keys: string[]
): DataClumpsList[] {
  return dataClumpsList.filter(
    (clump) =>
      clump.smellyMethods &&
      clump.smellyMethods.some((smellyMethod) =>
        keys.includes(smellyMethod.key)
      )
  );
}
