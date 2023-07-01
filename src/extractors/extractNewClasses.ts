import {
  ClassDeclaration,
  MethodDeclaration,
  Project,
  PropertyAccessExpression,
  Scope,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import {
  DataClumpsList,
  SmellyMethods,
  ParameterInfo,
  NewClassInfo,
  MethodInfo,
} from "../utils/Interfaces";
import { existsSync } from "fs";
import path = require("path");
const project = new Project();
const outputPath = "./src/output/extractedClasses/";

function generateUniqueFileName(baseName: string): string {
  let counter = 0;
  let fileName = `${baseName}.ts`;

  while (existsSync(`${outputPath}${fileName}`)) {
    counter++;
    fileName = `${baseName}${counter}.ts`;
  }

  return fileName;
}

function exportNewFileData(
  newClassDeclaration: ClassDeclaration,
  fileName: string
) {
  const filePath = outputPath + fileName;

  const project = new Project();
  const sourceFile: SourceFile = project.createSourceFile(filePath);
  sourceFile.addClass(newClassDeclaration.getStructure());

  project.saveSync();

  return { className: newClassDeclaration.getName(), filepath: filePath };
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

function createNewClass(
  fileName: string,
  newClassName: string
): ClassDeclaration {
  const srcFile = project.createSourceFile(
    `src/output/extractedClasses/${fileName}`,
    "",
    { overwrite: true }
  );

  const newClass = srcFile.addClass({
    name: newClassName,
    isExported: true,
  });

  return newClass;
}

function defineClassVariables(
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

function implementConstructor(
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

function createGettersAndSetters(
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

export function createNewClassesFromDataClumpsList(
  dataClumpsList: DataClumpsList[]
) {
  dataClumpsList.forEach((dataClump) => {
    const leastParameterMethod = getMethodWithLeastParameters(dataClump);

    // Generate newClassName by joining parameter names
    let newClassName = leastParameterMethod.methodInfo.parameters
      .map(
        (parameter) =>
          parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
      )
      .join("");

    // If no parameters, fallback to the class name
    if (newClassName === "") {
      newClassName = leastParameterMethod.classInfo.className;
    }

    // File name should be based on the class name
    const fileName = generateUniqueFileName(
      leastParameterMethod.classInfo.className
    );

    const newClassDeclaration = createNewClass(fileName, newClassName);

    defineClassVariables(leastParameterMethod, newClassDeclaration);

    implementConstructor(leastParameterMethod, newClassDeclaration);

    createGettersAndSetters(leastParameterMethod, newClassDeclaration);

    const newClassInfo = exportNewFileData(newClassDeclaration, fileName);

    // Refactor all methods in the smellyMethods group
    dataClump.smellyMethods?.forEach((smellyMethod) => {
      refactorSmellyMethod(smellyMethod, newClassInfo);
    });

    console.log(
      `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
    );
  });

  project.saveSync();
}

function parseFileToAst(filepath: string): SourceFile {
  return project.addSourceFileAtPath(filepath);
}

function getImportPath(from: string, to: string) {
  let relativePath = path.relative(path.dirname(from), to).replace(/\\/g, "/");

  if (!relativePath.startsWith("../") && !relativePath.startsWith("./")) {
    relativePath = "./" + relativePath;
  }

  // replace .ts or .js at the end of relative path
  relativePath = relativePath.replace(".ts", "");

  return relativePath;
}

// Rest of the code remains same ..

function importNewClass(file: SourceFile, newClassInfo: NewClassInfo) {
  const filePath = file.getFilePath();
  const correctPath = getImportPath(filePath, newClassInfo.filepath);

  const existingImport = file.getImportDeclaration(
    (declaration) =>
      declaration.getModuleSpecifierValue() === correctPath &&
      declaration
        .getNamedImports()
        .some((namedImport) => namedImport.getName() === newClassInfo.className)
  );

  if (!existingImport) {
    file.addImportDeclaration({
      moduleSpecifier: correctPath,
      namedImports: [newClassInfo.className],
    });
  }
}

function findMethodInAst(
  file: SourceFile,
  methodInfo: MethodInfo
): MethodDeclaration | undefined {
  const classes = file.getClasses();
  let methodDeclaration: MethodDeclaration | undefined;

  classes.some((cls) => {
    methodDeclaration = cls.getMethod(methodInfo.methodName);
    return methodDeclaration !== undefined;
  });

  return methodDeclaration;
}

function replaceParameters(
  method: MethodDeclaration,
  newClassInfo: NewClassInfo,
  smellyMethod: SmellyMethods
) {
  if (
    method.getParameters().length === smellyMethod.methodInfo.parameters.length
  ) {
    method.getParameters().forEach((param) => param.remove());
    method.addParameter({
      name: "newParam",
      type: newClassInfo.className,
    });
  } else {
    method.getParameters().forEach((param) => {
      smellyMethod.methodInfo.parameters.forEach((smellyParam) => {
        if (param.getName() === smellyParam.name) {
          param.remove();
          method.addParameter({
            name: smellyParam.name,
            type: newClassInfo.className,
          });
        }
      });
    });
  }
}

function updateReferences(
  method: MethodDeclaration,
  smellyMethod: SmellyMethods
) {
  let methodBody = method.getBodyText();
  smellyMethod.methodInfo.parameters.forEach((parameter) => {
    const getterName = `get${
      parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    }`;
    const setterName = `set${
      parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    }`;

    // Regular expression to find assignments to this parameter
    const assignmentRegex = new RegExp(
      `(\\b${parameter.name}\\s*=\\s*)([^;]+)`,
      "g"
    );
    methodBody = methodBody.replace(
      assignmentRegex,
      `newParam.${setterName}($2)`
    );

    // Replace direct usage of the parameter with getter
    const usageRegex = new RegExp(`\\b${parameter.name}\\b`, "g");
    methodBody = methodBody.replace(usageRegex, `newParam.${getterName}()`);
  });

  method.setBodyText(methodBody);
}

function handleCallsInSameClass(
  classDeclaration: ClassDeclaration,
  refactoredMethod: MethodDeclaration,
  newClassInfo: NewClassInfo,
  smellyMethod: SmellyMethods
) {
  const refactoredMethodName = refactoredMethod.getName();
  classDeclaration.getMethods().forEach((method) => {
    if (method === refactoredMethod) {
      return;
    }
    method
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .forEach((callExpression) => {
        const expression = callExpression.getExpression();
        if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
          const propertyAccessExpression =
            expression as PropertyAccessExpression;
          if (propertyAccessExpression.getName() === refactoredMethodName) {
            const args = callExpression.getArguments();
            if (args.length === smellyMethod.methodInfo.parameters.length) {
              const newInstanceName = `${smellyMethod.methodInfo.methodName}Instance`;
              const newInstance = `${newInstanceName} = new ${
                newClassInfo.className
              }(${args.map((arg) => arg.getText()).join(", ")});`;
              const parentStatementIndex = callExpression
                .getFirstAncestorByKind(SyntaxKind.ExpressionStatement)
                .getChildIndex();
              if (parentStatementIndex !== undefined) {
                method
                  .getBody()
                  .insertStatements(parentStatementIndex, newInstance);
                callExpression.replaceWithText(
                  `${propertyAccessExpression.getText()}(${newInstanceName})`
                );
              }
            }
          }
        }
      });
  });
}

export function refactorSmellyMethod(
  smellyMethod: SmellyMethods,
  newClassInfo: NewClassInfo
) {
  const file = parseFileToAst(smellyMethod.classInfo.filepath);
  importNewClass(file, newClassInfo);

  const method = findMethodInAst(file, smellyMethod.methodInfo);
  if (method) {
    replaceParameters(method, newClassInfo, smellyMethod);
    updateReferences(method, smellyMethod);

    // Get the class containing the smelly method
    const className = smellyMethod.classInfo.className;
    const classDeclaration = file
      .getClasses()
      .find((cls) => cls.getName() === className);

    if (classDeclaration) {
      handleCallsInSameClass(
        classDeclaration,
        method,
        newClassInfo,
        smellyMethod
      );
    }
  }

  file.saveSync();
}
