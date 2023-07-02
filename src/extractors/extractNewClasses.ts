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
const outputPath = "./src/output/extractedClasses/";

export function createNewClassesFromDataClumpsList(
  dataClumpsList: DataClumpsList[]
) {
  dataClumpsList.forEach((smellymethodGroup) => {
    createNewClass(smellymethodGroup);
  });

  project.saveSync();
}

function createNewClass(smellymethodGroup) {
  const leastParameterMethod = getMethodWithLeastParameters(smellymethodGroup);
  let newClassName = getNewClassName(leastParameterMethod);
  const fileName = generateUniqueFileName(
    leastParameterMethod.classInfo.className
  );

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    leastParameterMethod
  );
  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    leastParameterMethod.methodInfo.parameters
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

function getNewClassName(leastParameterMethod) {
  return leastParameterMethod.methodInfo.parameters
    .map(
      (parameter) =>
        parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    )
    .join("");
}

function generateUniqueFileName(baseName: string): string {
  let counter = 0;
  let fileName = `${baseName}.ts`;

  while (existsSync(`${outputPath}${fileName}`)) {
    counter++;
    fileName = `${baseName}${counter}.ts`;
  }

  return fileName;
}

function createAndGetNewClass(newClassName, fileName, leastParameterMethod) {
  const newClassDeclaration = initializeNewClass(fileName, newClassName);
  generateClassVariables(leastParameterMethod, newClassDeclaration);
  generateConstructor(leastParameterMethod, newClassDeclaration);
  generateGettersAndSetters(leastParameterMethod, newClassDeclaration);

  return newClassDeclaration;
}

function initializeNewClass(fileName, className) {
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
  parameters: ParameterInfo[]
): NewClassInfo {
  const filePath = outputPath + fileName;
  return {
    className: newClassDeclaration.getName(),
    filepath: filePath,
    parameters: parameters,
  };
}

// //Refactoring
// function getSmellyMethod(file, methodName: string) {
//   return file.getFunction(methodName);
// }

// function getImportPath(from: string, to: string) {
//   let relativePath = path.relative(path.dirname(from), to).replace(/\\/g, "/");

//   if (!relativePath.startsWith("../") && !relativePath.startsWith("./")) {
//     relativePath = "./" + relativePath;
//   }

//   // replace .ts or .js at the end of relative path
//   relativePath = relativePath.replace(".ts", "");

//   return relativePath;
// }

// function importNewClass(file: SourceFile, newClassInfo: NewClassInfo) {
//   const filePath = file.getFilePath();
//   const correctPath = getImportPath(filePath, newClassInfo.filepath);

//   const existingImport = file.getImportDeclaration(
//     (declaration) =>
//       declaration.getModuleSpecifierValue() === correctPath &&
//       declaration
//         .getNamedImports()
//         .some((namedImport) => namedImport.getName() === newClassInfo.className)
//   );

//   if (!existingImport) {
//     file.addImportDeclaration({
//       moduleSpecifier: correctPath,
//       namedImports: [newClassInfo.className],
//     });
//   }
// }

// function refactorSmellyMethodParameters(
//   method: FunctionDeclaration,
//   commonParams: ParameterInfo[]
// ) {
//   const params = method.getParameters();

//   for (let i = 0; i < params.length; i++) {
//     const param = params[i];
//     const commonParam = commonParams.find((p) => p.name === param.getName());

//     if (commonParam) {
//       param.setType(commonParam.type);
//       if (commonParam.value) {
//         param.setInitializer(commonParam.value);
//       }
//     }
//   }
// }

// //
// //
// //
// //
// //
// //
// //
// //
// //
// // Step 4.3.4: Refactor parameters in the smelly method
// function refactorParameters(
//   method: FunctionDeclaration,
//   methodInfo: MethodInfo,
//   newClassInfo: NewClassInfo
// ) {
//   const parameters = method.getParameters();
//   const commonParameters = methodInfo.parameters.filter((param) =>
//     parameters.some((p) => p.getName() === param.name)
//   );

//   if (commonParameters.length === parameters.length) {
//     // Replace all parameters with a single instance of the new class
//     const newClassInstance = method.insertParameter(0, {
//       name: "newClassInstance",
//       type: newClassInfo.className,
//     });
//     parameters.forEach((param) => param.remove());
//   } else {
//     // Replace only common parameters, leave the rest as is
//     commonParameters.forEach((param) => {
//       const index = parameters.findIndex((p) => p.getName() === param.name);
//       if (index !== -1) {
//         parameters[index].replaceWithText(`newClassInstance.${param.name}`);
//       }
//     });
//   }
// }

// // Step 4.3.5: Update variables/references within the method using the generated getters and setters
// function updateMethodVariables(
//   method: FunctionDeclaration,
//   methodInfo: MethodInfo
// ): void {
//   method.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
//     const name = identifier.getText();
//     if (methodInfo.parameters.find((param) => param.name === name)) {
//       identifier.replaceWithText(`newClassInstance.${name}`);
//     }
//   });
// }
// // Update variables/references within the method using the generated getters and setters
// function updateMethodAssignments(
//   method: FunctionDeclaration,
//   methodInfo: MethodInfo
// ): void {
//   method
//     .getDescendantsOfKind(SyntaxKind.BinaryExpression)
//     .forEach((expression) => {
//       if (expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
//         const left = expression.getLeft();
//         const right = expression.getRight();

//         if (
//           left.getKind() === SyntaxKind.Identifier &&
//           methodInfo.parameters.find((param) => param.name === left.getText())
//         ) {
//           const setter = `set${capitalizeFirstLetter(left.getText())}`;
//           expression.replaceWithText(
//             `newClassInstance.${setter}(${right.getText()})`
//           );
//         }
//       }
//     });
// }

// // Step 4.3.6: Check the rest of the file (AST) for calls to the smelly method and refactor.
// // function refactorMethodCalls(
// //   file: SourceFile,
// //   methodInfo: MethodInfo,
// //   newClassInfo: NewClassInfo
// // ): void {
// //   file.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
// //     if (call.getExpression().getText() === methodInfo.methodName) {
// //       const parameters = call.getArguments().map((arg) => arg.getText());
// //       call.replaceWithText(
// //         `${methodInfo.methodName}(new ${
// //           newClassInfo.className
// //         }(${parameters.join(", ")}))`
// //       );
// //     }
// //   });
// // }

// function parseFileToAst(filepath: string): SourceFile {
//   return project.addSourceFileAtPath(filepath);
// }
// // Refactoring function for global calls
// function refactorGlobalCalls(
//   callsList: CallsList,
//   methodInfo: MethodInfo,
//   newClassInfo: NewClassInfo
// ): void {
//   callsList.callsGlob.forEach((call) => {
//     const file = parseFileToAst(call.classInfo.filepath);
//     refactorMethod(file, methodInfo, newClassInfo);
//     importNewClass(file, newClassInfo);
//     file.saveSync();
//   });
// }

// // Main refactoring function
// function refactorMethod(
//   file: SourceFile,
//   methodInfo: MethodInfo,
//   newClassInfo: NewClassInfo
// ): void {
//   const method = getSmellyMethod(file, methodInfo.methodName);
//   if (method) {
//     refactorParameters(method, methodInfo, newClassInfo);
//     updateMethodVariables(method, methodInfo);
//     updateMethodAssignments(method, methodInfo);
//     refactorMethodCalls(file, methodInfo, newClassInfo);
//     file.saveSync();
//   }
// }

// function capitalizeFirstLetter(string: string): string {
//   return string.charAt(0).toUpperCase() + string.slice(1);
// }
