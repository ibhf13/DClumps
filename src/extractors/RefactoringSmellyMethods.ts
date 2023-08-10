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

export function refactorMethods(
  newClassInfo: NewClassInfo,
  leastParameterMethod: SmellyMethods,
  Data_Clumps_List: DataClumpsList,
  project: Project
) {
  let userKeys: string[] = ["12"];
  let methodGroup: SmellyMethods[] = filterMethodsByKeys(
    Data_Clumps_List.smellyMethods,
    userKeys
  );
  for (const method of methodGroup) {
    refactorSelectedMethod(newClassInfo, method, project);
    //console.log(method.methodInfo, method.classInfo.className);
  }

  project.saveSync();
}

function filterMethodsByKeys(
  methods: SmellyMethods[],
  keys: string[]
): SmellyMethods[] {
  return methods.filter((method) => keys.includes(method.key));
}

// function removeSelectedMethod(
//   leastParameterMethod: SmellyMethods,
//   methodGroupCopy: DataClumpsList
// ): SmellyMethods[] {
//   return methodGroupCopy.smellyMethods.filter(
//     (method) => method !== leastParameterMethod
//   );
// }

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

  const globalCalls: GlobalCalls[] =
    refactoredMethod.callsInfo.callsList.callsGlob;
  globalCalls.forEach((call) => {
    const callFile = project.addSourceFileAtPath(call.classInfo.filepath);
    refactorMethodInOtherFile(newClassInfo, refactoredMethod, callFile);
  });

  project.saveSync();
}

function refactorMethodCallsUsingThis(
  newClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  allMethods: MethodDeclaration[]
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
      console.log("------------ ", instanceName);

      UpdateMethodInOtherFile(
        newClassInfo,
        refactoredMethod,
        methodCallExpressions,
        instanceName
      );
      console.log(`Replaced arguments in ${callSourceFile.getFilePath()}`);
    }
  });
}

function UpdateMethodInOtherFile(
  newClassInfo: NewClassInfo,
  refactoredMethod: SmellyMethods,
  methodCallExpressions: CallExpression[],
  instanceName: string
) {
  const newClassParamTypes = newClassInfo.parameters.map((param) => param.type);

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
        arg.getText().startsWith(`new ${newClassInfo.className}`)
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
          newClassInfo.className
        }(${newClassArguments.join(", ")})`;
        const updatedArgumentsList = [newArgument, ...otherArguments];

        callExpression.replaceWithText(
          `${calledMethodName.split(".")[0]}.${
            refactoredMethod.methodInfo.methodName
          }(${updatedArgumentsList.join(", ")})`
        );
      }
    }
  });
}

function updateMethodParameters(
  newClassInfo: NewClassInfo,
  method: MethodDeclaration
) {
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
  method: MethodDeclaration,
  sharedParameters: ParameterDeclaration[]
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
function updateMethodWithGetter(
  newClassInfo: NewClassInfo,
  method: MethodDeclaration
) {
  const instance = getInstanceName(newClassInfo);

  method.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
    const paramName = identifier.getText();
    if (parameterExists(paramName, newClassInfo.parameters)) {
      const getterExpression = `${instance}.get${toCamelCase(paramName)}()`;
      identifier.replaceWithText(getterExpression);
    }
  });
}
