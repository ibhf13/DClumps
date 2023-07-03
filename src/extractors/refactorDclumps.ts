import {
  BinaryExpression,
  Identifier,
  Project,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
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
  project.saveSync();
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
  const instanceName = `${newClassInfo.className
    .charAt(0)
    .toLowerCase()}${newClassInfo.className.slice(1)}Instance`;

  method.addParameter({
    name: instanceName,
    type: newClassInfo.className,
  });

  return commonParameters;
}

function processLeftSide(leftText, instance, newClassInfo) {
  if (isCommonParmeter(leftText, newClassInfo.parameters)) {
    return `${instance}.set${getCamelCase(leftText)}`;
  }

  return leftText;
}

function processRightSide(rightText, instance, newClassInfo) {
  if (isCommonParmeter(rightText, newClassInfo.parameters)) {
    return `${instance}.get${getCamelCase(rightText)}()`;
  }

  return rightText;
}

function processBinaryExpression(binaryExpression, instance, newClassInfo) {
  const left = binaryExpression.getLeft();
  const right = binaryExpression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  // Handle nested binary expressions
  if (right.getKind() === SyntaxKind.BinaryExpression) {
    rightText = processBinaryExpression(right, instance, newClassInfo);
  }

  // Determine if the expression is an assignment
  const isAssignment =
    binaryExpression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;

  if (isAssignment) {
    leftText = processLeftSide(leftText, instance, newClassInfo);
    rightText = processRightSide(rightText, instance, newClassInfo);
    return `${leftText}(${rightText})`; // Don't include the "=" operator in the updated expression.
  } else {
    // For other binary expressions, both sides should use a getter
    if (isCommonParmeter(leftText, newClassInfo.parameters)) {
      leftText = `${instance}.get${getCamelCase(leftText)}()`;
    }
    if (isCommonParmeter(rightText, newClassInfo.parameters)) {
      rightText = `${instance}.get${getCamelCase(rightText)}()`;
    }
    return `${leftText} ${binaryExpression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

function updateMethodBody(newClassInfo, method, commonParameters) {
  const instance = `${newClassInfo.className
    .charAt(0)
    .toLowerCase()}${newClassInfo.className.slice(1)}Instance`;

  console.log(`Method instance: ${instance}`);

  const binaryExpressions = method.getDescendantsOfKind(
    SyntaxKind.BinaryExpression
  );
  method
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression instanceof BinaryExpression) {
        for (let i = binaryExpressions.length - 1; i >= 0; i--) {
          const binaryExpression = binaryExpressions[i];
          const newExpression = processBinaryExpression(
            binaryExpression,
            instance,
            newClassInfo
          );
          console.log(
            `Replacing: ${binaryExpression.getText()} with: ${newExpression}`
          );
          binaryExpression.replaceWithText(newExpression);
        }
      } else {
        const identifier = expression as Identifier;
        const paramName = identifier.getText();
        if (isCommonParmeter(paramName, newClassInfo.parameters)) {
          const getterExpression = `${instance}.get${getCamelCase(
            paramName
          )}()`;
          console.log(`Replacing: ${paramName} with: ${getterExpression}`);
          identifier.replaceWithText(getterExpression);
        }
      }
    });

  for (const param of commonParameters) {
    console.log(`Removing common parameter: ${param.getName()}`);
    param.remove();
  }
}

function getCamelCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

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
