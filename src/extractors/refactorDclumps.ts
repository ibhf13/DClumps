import { Project, SourceFile, SyntaxKind } from "ts-morph";
import * as path from "path";
import {
  DataClumpsList,
  MethodInfo,
  NewClassInfo,
  ParameterInfo,
  SmellyMethods,
} from "../utils/Interfaces";

export function refactorMethods(
  newClassInfo: NewClassInfo,
  leastParameterMethod: SmellyMethods,
  smellymethodGroup: SmellyMethods,
  project: Project
) {
  //   let smellyMethodGroupCopy = deleteLeastParameterMethod(
  //     leastParameterMethod,
  //     smellymethodGroup
  //   );

  // Refactor the least parameter method.
  refactorLeastParameterMethod(newClassInfo, leastParameterMethod, project);
}

function deleteLeastParameterMethod(
  leastParameterMethod: SmellyMethods,
  smellymethodGroupCopy: DataClumpsList
): SmellyMethods[] {
  // Filter out the leastParameterMethod
  return smellymethodGroupCopy.smellyMethods.filter(
    (method) =>
      method.methodInfo.methodName !==
      leastParameterMethod.methodInfo.methodName
  );
}

function isCommonParmeter(
  paramName: string,
  newClassParams: ParameterInfo[]
): boolean {
  return newClassParams.some((param) => param.name === paramName);
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

function refactorLeastParameterMethod(
  newClassInfo: NewClassInfo,
  leastParameterMethod: SmellyMethods,
  project: Project
) {
  console.log(
    `Refactoring ${leastParameterMethod.methodInfo.methodName} \n in ${leastParameterMethod.classInfo.filepath} `
  );

  const sourceFile = project.addSourceFileAtPath(
    leastParameterMethod.classInfo.filepath
  );

  importNewClass(sourceFile, newClassInfo);

  const method = sourceFile
    .getClass(leastParameterMethod.classInfo.className)
    .getMethod(leastParameterMethod.methodInfo.methodName);

  const commonParameters = updateMethodParameter(newClassInfo, method);
  updateMethodBody(newClassInfo, method, commonParameters);
}

function updateMethodParameter(newClassInfo: NewClassInfo, method) {
  const methodParams = method.getParameters();

  const commonParameters = methodParams.filter((param) =>
    isCommonParmeter(param.getName(), newClassInfo.parameters)
  );
  const uncommonParameters = methodParams.filter(
    (param) => !isCommonParmeter(param.getName(), newClassInfo.parameters)
  );

  uncommonParameters.forEach((param) => {
    method.insertParameter(0, {
      name: param.getName(),
      type: param.getType().getText(),
    });
  });

  method.addParameter({
    name: `${newClassInfo.className}Instance`,
    type: newClassInfo.className,
  });

  return commonParameters;
}

function updateMethodBody(
  newClassInfo: NewClassInfo,
  method,
  commonParameters
) {
  const instance = `${newClassInfo.className}Instance`;
  console.log(`Method instance: ${instance}`);

  // First pass: collect all binary expressions and their replacements
  const replacements = [];
  const binaryExpressions = method.getDescendantsOfKind(
    SyntaxKind.BinaryExpression
  );

  // Start from innermost BinaryExpressions
  for (let i = binaryExpressions.length - 1; i >= 0; i--) {
    const binaryExpression = binaryExpressions[i];
    const left = binaryExpression.getLeft();
    const right = binaryExpression.getRight();

    if (
      isCommonParmeter(left.getText(), newClassInfo.parameters) ||
      isCommonParmeter(right.getText(), newClassInfo.parameters)
    ) {
      console.log(`Binary expression: ${binaryExpression.getText()}`);
      let replacement;
      console.log("right---------------------\n", right.getText());
      console.log("left---------------------\n", left.getText());

      if (isCommonParmeter(right.getText(), newClassInfo.parameters)) {
        replacement = `${left.getText()} = ${instance}.get${getCamelCase(
          right.getText()
        )}()`;
        console.log(`Replacement: ${replacement}`);
      }
      if (isCommonParmeter(left.getText(), newClassInfo.parameters)) {
        console.log("setright---------------------\n", right.getText());

        replacement = `${instance}.set${getCamelCase(
          left.getText()
        )}(${right.getText()})`;
        console.log(`Replacement: ${replacement}`);
      }

      replacements.push({ binaryExpression, replacement });
    }
  }

  // Second pass: do the replacements
  for (const { binaryExpression, replacement } of replacements) {
    console.log(
      `Replacing: ${binaryExpression.getText()} with: ${replacement}`
    );
    binaryExpression.replaceWithText(replacement);
  }

  for (const param of commonParameters) {
    console.log(`Removing common parameter: ${param.getName()}`);
    param.remove();
  }
}

function getCamelCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// function capitalizeFirstLetter(string) {
//   return string.charAt(0).toUpperCase() + string.slice(1);
// }

// function useGetter(instance: string, param: string): string {
//   return `${instance}.get${param.charAt(0).toUpperCase() + param.slice(1)}()`;
// }
//
// function getSmellyMethod(file, methodName: string) {
//   return file.getFunction(methodName);
// }
//
// function parseFileToAst(filepath: string, project: Project): SourceFile {
//   return project.addSourceFileAtPath(filepath);
// }
// // 4.3.4 Refactor the old parameters
// function refactorParameters(method: any, oldParams: ParameterInfo[]) {
//   const newParams = method.getParameters();

//   oldParams.forEach((oldParam, index) => {
//     const correspondingNewParam = newParams[index];

//     if (correspondingNewParam) {
//       // 4.3.4.1 If the parameter has a corresponding one in the new method, replace it
//       correspondingNewParam.replaceWithText(oldParam.name);
//     } else {
//       // 4.3.4.2 If there is no corresponding parameter in the new method, add it to the end
//       method.addParameter({
//         name: oldParam.name,
//         type: oldParam.type,
//       });
//     }
//   });

//   // If there are more parameters in the new method, remove them
//   for (let i = oldParams.length; i < newParams.length; i++) {
//     newParams[i].remove();
//   }
// }

// // 4.3.5 Update variables/references within the method using the generated getters and setters.
// function updateMethodReferences(
//   method: any,
//   oldParams: ParameterInfo[],
//   newClassInfo: NewClassInfo
// ) {
//   const methodBody = method.getBody();

//   methodBody
//     .getDescendantsOfKind(SyntaxKind.Identifier)
//     .forEach((identifier) => {
//       const identifierName = identifier.getText();

//       oldParams.forEach((oldParam) => {
//         if (identifierName === oldParam.name) {
//           // Replace the identifier with a getter or setter
//           // If the identifier is on the left side of an assignment, use a setter
//           if (
//             identifier.getParentIfKind(SyntaxKind.PropertyAccessExpression) &&
//             identifier
//               .getParentIfKind(SyntaxKind.PropertyAccessExpression)
//               .getChildren()[2] === identifier &&
//             identifier.getParentIfKind(SyntaxKind.BinaryExpression) &&
//             identifier
//               .getParentIfKind(SyntaxKind.BinaryExpression)
//               .getOperatorToken()
//               .getKind() === SyntaxKind.EqualsToken
//           ) {
//             const assignment = identifier.getParentIfKind(
//               SyntaxKind.BinaryExpression
//             );
//             const newValue = assignment.getRight().getText();

//             assignment.replaceWithText(
//               `${newClassInfo.className}.${oldParam.name} = ${newValue}`
//             );
//           } else {
//             // Otherwise, use a getter
//             identifier.replaceWithText(
//               `${newClassInfo.className}.${oldParam.name}`
//             );
//           }
//         }
//       });
//     });
// }

// // Given a method and a new class info, refactor the method to use the new class
// export function refactorMethod(
//   smellyMethod: SmellyMethods,
//   newClassInfo: NewClassInfo,
//   project: Project
// ): void {
//   const file = parseFileToAst(smellyMethod.filepath, project);
//   importNewClass(file, newClassInfo);

//   const smellyMethod123 = getSmellyMethod(file, methodInfo.methodName);

//   refactorParameters(smellyMethod, methodInfo.parameters, newClassInfo);
//   updateMethodReferences(smellyMethod, methodInfo.parameters, newClassInfo);

//   file.saveSync();
// }
