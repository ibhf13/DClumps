import {
  BinaryExpression,
  Project,
  SourceFile,
  SyntaxKind,
  ts,
} from "ts-morph";
import * as path from "path";
import {
  DataClumpsList,
  NewClassInfo,
  ParameterInfo,
  SmellyMethods,
} from "../utils/Interfaces";

export function refactorMethods(
  newClassInfo: NewClassInfo,
  leastParameterMethod: SmellyMethods,
  methodGroup: DataClumpsList,
  project: Project
) {
  refactorSelectedMethod(newClassInfo, leastParameterMethod, project);
  const methodGroupCopy = removeSelectedMethod(
    leastParameterMethod,
    methodGroup
  );

  for (const method of methodGroupCopy) {
    refactorSelectedMethod(newClassInfo, method, project);
    //console.log(method.methodInfo, method.classInfo.className);
  }

  project.saveSync();
}

function removeSelectedMethod(
  leastParameterMethod: SmellyMethods,
  methodGroupCopy: DataClumpsList
): SmellyMethods[] {
  return methodGroupCopy.smellyMethods.filter(
    (method) => method !== leastParameterMethod
  );
}

function parameterExists(
  paramName: string,
  newClassParams: ParameterInfo[]
): boolean {
  return newClassParams.some((param) => param.name === paramName);
}

function determineImportPath(from: string, to: string) {
  let relativePath = path.relative(path.dirname(from), to).replace(/\\/g, "/");

  if (!relativePath.startsWith("../") && !relativePath.startsWith("./")) {
    relativePath = "./" + relativePath;
  }

  relativePath = relativePath.replace(".ts", "");

  return relativePath;
}

function importNewClass(file: SourceFile, newClassInfo: NewClassInfo) {
  const filePath = file.getFilePath();
  const correctPath = determineImportPath(filePath, newClassInfo.filepath);

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

function refactorSelectedMethod(
  newClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  project: Project
) {
  const sourceFile = project.addSourceFileAtPath(
    refactoredMethod.classInfo.filepath
  );

  importNewClass(sourceFile, newClassInfo);

  const classDeclaration = sourceFile.getClass(
    refactoredMethod.classInfo.className
  );

  const method = classDeclaration.getMethod(
    refactoredMethod.methodInfo.methodName
  );
  const allMethods = classDeclaration.getMethods();

  const sharedParameters = updateMethodParameters(newClassInfo, method);
  updateMethodBody(newClassInfo, method, sharedParameters);

  refactorMethodCallsUsingThis(newClassInfo, refactoredMethod, allMethods);
  refactorMethodInOtherFile(newClassInfo, refactoredMethod, sourceFile);

  project.saveSync();
}

function refactorMethodCallsUsingThis(
  newClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  allMethods
) {
  const newClassParamTypes = newClassInfo.parameters.map((param) => param.type);

  allMethods.forEach((meth) => {
    const methodCallExpressions = meth.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );
    methodCallExpressions.forEach((callExpression) => {
      if (
        callExpression.getExpression().getText() ===
        `this.${refactoredMethod.methodInfo.methodName}`
      ) {
        const argumentsList = callExpression.getArguments();
        let newClassArguments = [];
        let otherArguments = [];

        // Check for existing newClass instance in arguments
        const existingNewClassInstance = argumentsList.find((arg) =>
          arg.getText().startsWith(`new ${newClassInfo.className}`)
        );

        // Only process common and uncommon parameters if newClass instance doesn't already exist
        if (!existingNewClassInstance) {
          for (let i = 0; i < argumentsList.length; i++) {
            let argumentsType = argumentsList[i].getType().getLiteralValue();
            let found = false;

            for (let j = 0; j < newClassParamTypes.length; j++) {
              if (getType(argumentsType) === newClassParamTypes[j]) {
                found = true;
                newClassArguments.push(argumentsList[i].getText());
                newClassParamTypes.splice(j, 1); // Remove common type to avoid duplication
                break;
              }
            }

            if (!found) {
              otherArguments.push(argumentsList[i].getText());
            }
          }
          const newArgument = `new ${
            newClassInfo.className
          }(${newClassArguments.join(", ")})`;
          const updatedArgumentsList = [newArgument, ...otherArguments];

          callExpression.replaceWithText(
            `this.${
              refactoredMethod.methodInfo.methodName
            }(${updatedArgumentsList.join(", ")})`
          );

          //console.log(`Replaced arguments in ${meth.getName()}`);
        }
      }
    });
  });
}

function refactorMethodInOtherFile(
  newClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  callSourceFile: SourceFile
) {
  const newClassParamTypes = newClassInfo.parameters.map((param) => param.type);
  const methodCallExpressions = callSourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  );

  methodCallExpressions.forEach((callExpression) => {
    const calledMethodName = callExpression.getExpression().getText();
    if (
      !calledMethodName.startsWith("this.") &&
      calledMethodName.endsWith(`.${refactoredMethod.methodInfo.methodName}`)
    ) {
      const argumentsList = callExpression.getArguments();
      let newClassArguments = [];
      let otherArguments = [];

      const existingNewClassInstance = argumentsList.find((arg) =>
        arg.getText().startsWith(`new ${newClassInfo.className}`)
      );

      if (!existingNewClassInstance) {
        for (let i = 0; i < argumentsList.length; i++) {
          const argumentType = argumentsList[i].getType().getLiteralValue();
          let found = false;

          for (let j = 0; j < newClassParamTypes.length; j++) {
            if (typeof argumentType === newClassParamTypes[j]) {
              found = true;
              newClassArguments.push(argumentsList[i].getText());
              newClassParamTypes.splice(j, 1);
              break;
            }
          }

          if (!found) {
            otherArguments.push(argumentsList[i].getText());
          }
        }

        const newArgument = `new ${
          newClassInfo.className
        }(${newClassArguments.join(", ")})`;
        const updatedArgumentsList = [newArgument, ...otherArguments];

        callExpression.replaceWithText(
          `${calledMethodName.split(".")[0]}.${
            refactoredMethod.methodInfo.methodName
          }(${updatedArgumentsList.join(", ")})`
        );

        console.log(`Replaced arguments in ${callSourceFile.getFilePath()}`);
      }
    }
  });
}

function getType(value: any): string {
  return typeof value;
}

function updateMethodParameters(newClassInfo: NewClassInfo, method) {
  const methodParameters = method.getParameters();
  const sharedParameters = methodParameters.filter((param) =>
    parameterExists(param.getName(), newClassInfo.parameters)
  );

  const instanceName = getInstanceName(newClassInfo);

  // Check if the parameter is already there
  const alreadyHasInstance = methodParameters.some(
    (param) => param.getName() === instanceName
  );

  // Only add the instance if it does not already exist
  if (!alreadyHasInstance) {
    method.insertParameter(0, {
      name: instanceName,
      type: newClassInfo.className,
    });
  }

  return sharedParameters;
}

function getInstanceName(newClassInfo: NewClassInfo) {
  const instance = `${newClassInfo.className
    .charAt(0)
    .toLowerCase()}${newClassInfo.className.slice(1)}Instance`;
  return instance;
}

function processExpression(expression, instance, newClassInfo) {
  const left = expression.getLeft();
  const right = expression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    rightText = processExpression(right, instance, newClassInfo);
  }

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
  if (assignment) {
    if (parameterExists(leftText, newClassInfo.parameters)) {
      leftText = `${instance}.set${toCamelCase(leftText)}`;
    }

    if (parameterExists(rightText, newClassInfo.parameters)) {
      rightText = `${instance}.get${toCamelCase(rightText)}()`;
    }
    return `${leftText}(${rightText})`;
  } else {
    if (parameterExists(leftText, newClassInfo.parameters)) {
      leftText = `${instance}.get${toCamelCase(leftText)}()`;
    }
    if (parameterExists(rightText, newClassInfo.parameters)) {
      rightText = `${instance}.get${toCamelCase(rightText)}()`;
    }
    return `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

function updateMethodBody(
  newClassInfo: NewClassInfo,
  method,
  sharedParameters
) {
  const instance = getInstanceName(newClassInfo);

  const expressions = method.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  method
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression instanceof BinaryExpression) {
        expressions.reverse().forEach((binaryExpression) => {
          const newExpression = processExpression(
            binaryExpression,
            instance,
            newClassInfo
          );
          binaryExpression.replaceWithText(newExpression);
        });
      }
    });

  sharedParameters.forEach((param) => param.remove());
  updateMethodWithGetter(newClassInfo, method);
}
//cant put type for method because of the finding the right statement wont work
function updateMethodWithGetter(newClassInfo: NewClassInfo, method) {
  const instance = getInstanceName(newClassInfo);

  method.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
    const paramName = identifier.getText();
    if (parameterExists(paramName, newClassInfo.parameters)) {
      const getterExpression = `${instance}.get${toCamelCase(paramName)}()`;
      identifier.replaceWithText(getterExpression);
    }
  });
}

function toCamelCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}