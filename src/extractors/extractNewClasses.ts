import { ClassDeclaration, Project, Scope } from "ts-morph";
import {
  DataClumpsList,
  SmellyMethods,
  ParameterInfo,
  NewClassInfo,
} from "../utils/Interfaces";
import { existsSync } from "fs";
import { refactorMethods } from "./refactorDclumps";

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
    leastParameterMethod.classInfo.className,
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
  leastParameterMethod: SmellyMethods,
  outputPath: string
) {
  const newClassDeclaration = initializeNewClass(
    fileName,
    newClassName,
    outputPath
  );
  generateClassVariables(leastParameterMethod, newClassDeclaration);
  generateConstructor(leastParameterMethod, newClassDeclaration);
  generateGettersAndSetters(leastParameterMethod, newClassDeclaration);

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
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  smellyMethod.methodInfo.parameters.forEach((parameter: ParameterInfo) => {
    newClassDeclaration.addProperty({
      name: parameter.name,
      type: parameter.type,
      scope: Scope.Private,
    });
  });
}

function generateConstructor(
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  const constructorDeclaration = newClassDeclaration.addConstructor();

  smellyMethod.methodInfo.parameters.forEach(
    (parameter: ParameterInfo, index: number) => {
      constructorDeclaration.addParameter({
        name: parameter.name,
        type: parameter.type,
      });

      if (index === 0) {
        constructorDeclaration.setBodyText((writer) =>
          writer.write(`this.${parameter.name} = ${parameter.name};`)
        );
      } else {
        constructorDeclaration.addStatements((writer) =>
          writer.write(`this.${parameter.name} = ${parameter.name};`)
        );
      }
    }
  );
}

function generateGettersAndSetters(
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  smellyMethod.methodInfo.parameters.forEach((parameter: ParameterInfo) => {
    newClassDeclaration.addGetAccessor({
      name:
        "get" +
        parameter.name.charAt(0).toUpperCase() +
        parameter.name.slice(1),
      returnType: parameter.type,
      statements: `return this.${parameter.name};`,
    });

    newClassDeclaration.addSetAccessor({
      name:
        "set" +
        parameter.name.charAt(0).toUpperCase() +
        parameter.name.slice(1),
      parameters: [{ name: parameter.name, type: parameter.type }],
      statements: `this.${parameter.name} = ${parameter.name};`,
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
