import {
  BinaryExpression,
  CallExpression,
  ClassDeclaration,
  MethodDeclaration,
  ParameterDeclaration,
  Project,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import {
  CallsInfo,
  DataClumpsList,
  GlobalCalls,
  NewClassInfo,
  SmellyMethods,
} from "../utils/Interfaces";
import {
  getArgumentType,
  getInstanceName,
  importNewClass,
  parameterExists,
  toCamelCase,
} from "../utils/RefactorUtils";

export function refactorSmellyMethods(
  extractedClassInfo: NewClassInfo,
  methodGroup: SmellyMethods[],
  project: Project
) {
  for (const method of methodGroup) {
    refactorSelectedMethod(extractedClassInfo, method, project);
  }

  project.saveSync();
}

function refactorSelectedMethod(
  extractedClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  project: Project
) {
  const sourceFile = project.addSourceFileAtPath(
    refactoredMethod.classInfo.filepath
  );

  console.log("--------------------------");
  console.log("Start Refactoring");
  console.log("Class Name: ", refactoredMethod.classInfo.className);
  console.log("Method Name: ", refactoredMethod.methodInfo.methodName);
  console.log("At: ", refactoredMethod.classInfo.filepath);
  console.log("--------------------------");

  importNewClass(sourceFile, extractedClassInfo);

  const classDeclaration = sourceFile.getClass(
    refactoredMethod.classInfo.className
  );

  const method = classDeclaration.getMethod(
    refactoredMethod.methodInfo.methodName
  );
  const allMethods = classDeclaration.getMethods();

  const sharedParameters = updateMethodParameters(extractedClassInfo, method);
  updateMethodBody(extractedClassInfo, method, sharedParameters);

  console.log("--------------------------");
  console.log("Start Refactoring Calls in The same Class");
  console.log("--------------------------");

  refactorMethodCallsUsingThis(
    extractedClassInfo,
    refactoredMethod,
    allMethods
  );
  //refactorMethodInOtherFile(extractedClassInfo, refactoredMethod, sourceFile);

  const globalCalls: GlobalCalls[] =
    refactoredMethod.callsInfo.callsList.callsGlob;

  if (globalCalls.length > 0) {
    console.log("--------------------------");
    console.log("Start Refactoring Calls in other Class");

    globalCalls.forEach((call) => {
      console.log("Class Name: ", call.classInfo.className);
      console.log("At: ", call.classInfo.filepath);
      console.log("--------------------------");

      const callFile = project.addSourceFileAtPath(call.classInfo.filepath);
      refactorMethodInOtherFile(extractedClassInfo, refactoredMethod, callFile);
    });
  }

  project.saveSync();
}

function refactorMethodCallsUsingThis(
  extractedClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  allMethods: MethodDeclaration[]
) {
  const newClassParamTypes = extractedClassInfo.parameters.map(
    (param) => param.type
  );

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
          arg.getText().startsWith(`new ${extractedClassInfo.className}`)
        );

        // Only process common and uncommon parameters if newClass instance doesn't already exist
        if (!existingNewClassInstance) {
          for (let i = 0; i < newClassParamTypes.length; i++) {
            let foundIndex = argumentsList.findIndex(
              (arg) => getArgumentType(arg) === newClassParamTypes[i]
            );
            if (foundIndex !== -1) {
              newClassArguments.push(argumentsList[foundIndex].getText());
              argumentsList.splice(foundIndex, 1); // Remove common argument to avoid duplication
            } else {
              newClassArguments.push("undefined");
            }
          }
          otherArguments = argumentsList.map((arg) => arg.getText());

          const newArgument = `new ${
            extractedClassInfo.className
          }(${newClassArguments.join(", ")})`;
          const updatedArgumentsList = [newArgument, ...otherArguments];
          let result = `this.${
            refactoredMethod.methodInfo.methodName
          }(${updatedArgumentsList.join(", ")})`;
          if (result) {
            callExpression.replaceWithText(result);
          }
        }
      }
    });
  });
}

function refactorMethodInOtherFile(
  extractedClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  callSourceFile: SourceFile
) {
  importNewClass(callSourceFile, extractedClassInfo);
  const methodCallExpressions = callSourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  );

  const newInstanceDeclaration = callSourceFile.getDescendantsOfKind(
    SyntaxKind.NewExpression
  );
  newInstanceDeclaration.forEach((newExpression) => {
    if (
      refactoredMethod.classInfo.className ===
      newExpression.getExpression().getText()
    ) {
      const instanceName = newExpression
        .getParentIfKind(SyntaxKind.VariableDeclaration)
        .getName();

      UpdateMethodInOtherFile(
        extractedClassInfo,
        refactoredMethod,
        methodCallExpressions,
        instanceName
      );
    }
  });
}

function UpdateMethodInOtherFile(
  extractedClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  methodCallExpressions: CallExpression[],
  instanceName: string
) {
  const newClassParamTypes = extractedClassInfo.parameters.map(
    (param) => param.type
  );

  methodCallExpressions.forEach((callExpression) => {
    const calledMethodName = callExpression.getExpression().getText();

    if (
      calledMethodName.startsWith(instanceName) &&
      calledMethodName.endsWith(`.${refactoredMethod.methodInfo.methodName}`)
    ) {
      const argumentsList = callExpression.getArguments();
      let newClassArguments = [];
      let otherArguments = [];

      const existingNewClassInstance = argumentsList.find((arg) =>
        arg.getText().startsWith(`new ${extractedClassInfo.className}`)
      );

      if (!existingNewClassInstance) {
        for (let i = 0; i < newClassParamTypes.length; i++) {
          let foundIndex = argumentsList.findIndex(
            (arg) =>
              arg
                .getType()
                .getApparentType()
                .getText()
                .charAt(0)
                .toLowerCase() +
                arg.getType().getApparentType().getText().slice(1) ===
              newClassParamTypes[i]
          );
          if (foundIndex !== -1) {
            newClassArguments.push(argumentsList[foundIndex].getText());
            argumentsList.splice(foundIndex, 1); // Remove common argument to avoid duplication
          } else {
            newClassArguments.push("undefined");
          }
        }
        otherArguments = argumentsList.map((arg) => arg.getText());

        const newArgument = `new ${
          extractedClassInfo.className
        }(${newClassArguments.join(", ")})`;
        const updatedArgumentsList = [newArgument, ...otherArguments];
        let result = `${calledMethodName.split(".")[0]}.${
          refactoredMethod.methodInfo.methodName
        }(${updatedArgumentsList.join(", ")})`;
        if (result) {
          callExpression.replaceWithText(result);
        }
      }
    }
  });
}

function updateMethodParameters(
  extractedClassInfo: NewClassInfo,
  method: MethodDeclaration
) {
  const methodParameters = method.getParameters();
  const sharedParameters = methodParameters.filter((param) =>
    parameterExists(param.getName(), extractedClassInfo.parameters)
  );

  const instanceName = getInstanceName(extractedClassInfo);

  // Check if the parameter is already there
  const alreadyHasInstance = methodParameters.some(
    (param) => param.getName() === instanceName
  );

  // Only add the instance if it does not already exist
  if (!alreadyHasInstance) {
    method.insertParameter(0, {
      name: instanceName,
      type: extractedClassInfo.className,
    });
  }

  return sharedParameters;
}

function processExpression(expression, instance, extractedClassInfo) {
  const left = expression.getLeft();
  const right = expression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    rightText = processExpression(right, instance, extractedClassInfo);
  }

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
  if (assignment) {
    if (parameterExists(leftText, extractedClassInfo.parameters)) {
      leftText = `${instance}.set${toCamelCase(leftText)}`;

      if (parameterExists(rightText, extractedClassInfo.parameters)) {
        rightText = `${instance}.get${toCamelCase(rightText)}()`;
      }
      return `${leftText}(${rightText})`;
    }

    return `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;
  } else {
    if (parameterExists(leftText, extractedClassInfo.parameters)) {
      leftText = `${instance}.get${toCamelCase(leftText)}()`;
    }
    if (parameterExists(rightText, extractedClassInfo.parameters)) {
      rightText = `${instance}.get${toCamelCase(rightText)}()`;
    }
  }
}

function updateMethodBody(
  extractedClassInfo: NewClassInfo,
  method: MethodDeclaration,
  sharedParameters: ParameterDeclaration[]
) {
  const instance = getInstanceName(extractedClassInfo);

  // 1. Collect nodes
  const expressionsToReplace: BinaryExpression[] = [];
  method
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();
      if (expression instanceof BinaryExpression) {
        expressionsToReplace.push(expression);
      }
    });

  // 2. Replace them
  expressionsToReplace.forEach((binaryExpression) => {
    const newExpression = processExpression(
      binaryExpression,
      instance,
      extractedClassInfo
    );
    if (newExpression) {
      binaryExpression.replaceWithText(newExpression);
    }
  });

  sharedParameters.forEach((param) => param.remove());
  updateMethodWithGetter(extractedClassInfo, method);
}
//cant put type for method because of the finding the right statement wont work
function updateMethodWithGetter(
  extractedClassInfo: NewClassInfo,
  method: MethodDeclaration
) {
  const instance = getInstanceName(extractedClassInfo);

  method.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
    const paramName = identifier.getText();
    if (parameterExists(paramName, extractedClassInfo.parameters)) {
      const getterExpression = `${instance}.get${toCamelCase(paramName)}()`;
      if (getterExpression) {
        identifier.replaceWithText(getterExpression);
      }
    }
  });
}
