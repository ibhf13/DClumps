import {
  BinaryExpression,
  ClassDeclaration,
  Expression,
  ExpressionStatement,
  Identifier,
  MethodDeclaration,
  NewExpression,
  Project,
  Node,
  PropertyAccessExpression,
  SourceFile,
  SyntaxKind,
  VariableDeclaration,
  CallExpression,
  ConstructorDeclaration,
  ParameterDeclaration,
  PropertyDeclaration,
} from "ts-morph";
import {
  DataClumpsList,
  GlobalCalls,
  NewClassInfo,
  ParameterInfo,
  SmellyFields,
} from "../utils/Interfaces";
import {
  getInstanceName,
  toCamelCase,
  parameterExists,
  importNewClass,
  getSharedFields,
  removeSharedProperties,
  getArgumentType,
} from "../utils/RefactorUtils";

export function refactorSmellyFields(
  newClassInfo: NewClassInfo,
  leastParameterField: SmellyFields,
  smellyFieldGroup: DataClumpsList,
  project: Project
) {
  refactorSelectedClassFields(newClassInfo, leastParameterField, project);
  const fieldGroupCopy = removeSelectedField(
    leastParameterField,
    smellyFieldGroup
  );

  for (const field of fieldGroupCopy) {
    refactorSelectedClassFields(newClassInfo, field, project);
  }

  project.saveSync();
}

function removeSelectedField(
  smellyFieldGroup: SmellyFields,
  methodGroupCopy: DataClumpsList
): SmellyFields[] {
  return methodGroupCopy.smellyFieldGroup.filter(
    (field) => field !== smellyFieldGroup
  );
}

function refactorSelectedClassFields(
  newClassInfo: NewClassInfo,
  refactoredField: SmellyFields,
  project: Project
) {
  console.log("\n\nStart Refactoring in ", refactoredField.classInfo.filepath);

  const sourceFile = project.addSourceFileAtPath(
    refactoredField.classInfo.filepath
  );

  importNewClass(sourceFile, newClassInfo);

  const classToRefactor = sourceFile.getClass(
    refactoredField.classInfo.className
  );
  console.log("Starting Class : ", refactoredField.classInfo.className);

  const instanceName = getInstanceName(newClassInfo);
  console.log("....\nStart with updateFieldsInClass ");

  const sharedParameters = updateFieldsInClass(newClassInfo, classToRefactor);

  classToRefactor.getMethods().forEach((method) => {
    console.log(
      "then : refactorMethodBody for each method : ",
      method.getName()
    );
    refactorMethodBody(method, newClassInfo, sharedParameters, instanceName);
  });

  if (refactoredField.callsInfo.callsList.callsInSame > 0) {
    console.log(
      "--------------------\n",
      "refactoredField Calls in the same file ",
      refactoredField.classInfo.filepath,
      "\nthe name of the class :",
      classToRefactor.getName(),
      "\n--------------------"
    );

    findInstancesOfRefactoredClass(
      project,
      refactoredField.classInfo.filepath,
      classToRefactor,
      newClassInfo
    );
  }

  const globalCalls: GlobalCalls[] =
    refactoredField.callsInfo.callsList.callsGlob;
  globalCalls.forEach((call) => {
    project.saveSync();
    console.log(
      "--------------------\n",
      "refactoredField Calls in the other file ",
      call.classInfo.filepath,
      "\nthe name of the class :",
      classToRefactor.getName(),
      "\n--------------------"
    );
    findInstancesOfRefactoredClass(
      project,
      call.classInfo.filepath,
      classToRefactor,
      newClassInfo
    );
  });
  project.saveSync();
}

function createClassInstance(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  sharedParameters: string[]
) {
  const instanceName = getInstanceName(newClassInfo);
  const instanceParams = sharedParameters.map(
    (param) =>
      newClassInfo.parameters.find((p) => p.name === param)?.value ||
      "undefined"
  );

  const instanceParamsStr = instanceParams.join(", ");

  classToRefactor.insertProperty(0, {
    name: instanceName,
    type: newClassInfo.className,
    initializer: `new ${newClassInfo.className}(${instanceParamsStr})`,
  });

  return instanceName;
}

function updateFieldsInClass(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration
): string[] {
  const sharedParameters = getSharedFields(newClassInfo, classToRefactor);
  removeSharedProperties(classToRefactor, sharedParameters);
  const instanceName = createClassInstance(
    newClassInfo,
    classToRefactor,
    sharedParameters
  );
  refactorConstructor(
    newClassInfo,
    classToRefactor,
    instanceName,
    sharedParameters
  );

  return sharedParameters;
}

function replaceConstructorAssignments(
  constructor: ConstructorDeclaration,
  sharedParameters: string[],
  instanceName: string
) {
  constructor
    .getStatements()
    .filter(
      (statement) => statement.getKind() === SyntaxKind.ExpressionStatement
    )
    .forEach((statement) => {
      const expression = (statement as ExpressionStatement).getExpression();
      if (expression.getKind() === SyntaxKind.BinaryExpression) {
        const binaryExpression = expression as BinaryExpression;
        const left = binaryExpression.getLeft();
        const right = binaryExpression.getRight();
        if (
          left instanceof PropertyAccessExpression &&
          left.getExpression().getKind() === SyntaxKind.ThisKeyword &&
          sharedParameters.includes(left.getName())
        ) {
          binaryExpression.replaceWithText(
            `this.${instanceName}.set${toCamelCase(
              left.getName()
            )}(${right.getText()})`
          );
        }
      }
    });
}

function replaceConstructorParameters(
  constructor: ConstructorDeclaration,
  newClassInfo: NewClassInfo,
  sharedParameters: string[]
) {
  constructor.getParameters().forEach((param) => {
    if (sharedParameters.includes(param.getName())) {
      param.remove();
    }
  });
  constructor.insertParameter(0, {
    name: getInstanceName(newClassInfo),
    type: newClassInfo.className,
  });
}

function refactorConstructor(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  instanceName: string,
  sharedParameters: string[]
) {
  const constructor = classToRefactor.getConstructors()[0];
  if (!constructor) return;

  // Replace the parameters of the constructor
  replaceConstructorParameters(constructor, newClassInfo, sharedParameters);

  // Replace the assignments in the constructor body
  replaceConstructorAssignments(constructor, sharedParameters, instanceName);
}

function refactorMethodBody(
  method: MethodDeclaration,
  newClassInfo: NewClassInfo,
  sharedParameters: string[],
  instance: string
) {
  method
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression instanceof BinaryExpression) {
        const expressions = method.getDescendantsOfKind(
          SyntaxKind.BinaryExpression
        );
        expressions.reverse().forEach((binaryExpression) => {
          if (binaryExpression.getText().includes("this")) {
            const newExpression = processExpression(
              binaryExpression,
              instance,
              newClassInfo
            );
            binaryExpression.replaceWithText(newExpression);
          }
        });
      } else {
        updateGetterCalls(expression, sharedParameters, instance);
      }
    });
}

function updateGetterCalls(
  expression: Expression,
  sharedParameters: string[],
  instanceName: string
) {
  expression
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((propertyAccess) => {
      return (
        sharedParameters.includes(propertyAccess.getName()) &&
        propertyAccess.getExpression().getKind() === SyntaxKind.ThisKeyword
      );
    })
    .forEach((propertyAccess) => {
      propertyAccess.replaceWithText(
        `this.${instanceName}.get${toCamelCase(propertyAccess.getName())}()`
      );
    });
}

function processExpression(
  expression: BinaryExpression,
  instance: string,
  newClassInfo: NewClassInfo
): string {
  const left = expression.getLeft();
  const right = expression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    rightText = processExpression(right, instance, newClassInfo);
  }

  //Check if the left and right expressions contain 'this' or another instance name

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;

  if (assignment) {
    if (
      (left instanceof PropertyAccessExpression &&
        parameterExists(left.getName(), newClassInfo.parameters) &&
        left.getExpression().getKind() === SyntaxKind.Identifier) ||
      (right instanceof PropertyAccessExpression &&
        parameterExists(right.getName(), newClassInfo.parameters) &&
        right.getExpression().getKind() === SyntaxKind.Identifier)
    ) {
      return `${leftText} = ${rightText}`;
    }
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), newClassInfo.parameters) &&
      left.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      leftText = `this.${instance}.set${toCamelCase(left.getName())}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters) &&
      right.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    let result = `${leftText}(${rightText})`;

    return result;
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), newClassInfo.parameters) &&
      left.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      leftText = `this.${instance}.get${toCamelCase(left.getName())}()`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters) &&
      right.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }

    const result = `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;

    return result;
  }
}

function replacePropertyAccess(
  isThisReq: boolean,
  expression: PropertyAccessExpression,
  instanceName: string,
  refactoredInstance: string
): string {
  const propName = expression.getName();
  if (isThisReq) {
    return `this.${instanceName}.${refactoredInstance}.get${toCamelCase(
      propName
    )}()`;
  }
  return `${instanceName}.${refactoredInstance}.get${toCamelCase(propName)}()`;
}

function findInstancesOfRefactoredClass(
  project: Project,
  filepath: string,
  refactoredClass: ClassDeclaration,
  newClassInfo: NewClassInfo
) {
  const sourceFile = project.addSourceFileAtPath(filepath);
  const className = refactoredClass.getName();

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression),
    (node) => node.getExpression().getText() === className,
    newClassInfo
  );

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.Parameter),
    (node) => node.getText().includes(className),
    newClassInfo
  );

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration),
    (node) => node.getText().includes(className),
    newClassInfo
  );

  project.saveSync();
}
//checkFn : check fields name
function refactorNodes(nodes, checkFn, newClassInfo) {
  nodes.forEach((node) => {
    if (checkFn(node)) {
      if (node.getKind() === SyntaxKind.NewExpression) {
        // Handling NewExpressions logic
        const args = node.getArguments();
        if (args.length > 0) {
          //refactoredClassReferenceWithConstructor
          updateInstanceArguments(node, newClassInfo, args);
        } else {
          //refactoredClassReferenceWithout
          updateInstanceUsage(node, newClassInfo);
        }
      } else if (node.getKind() === SyntaxKind.Parameter) {
        // Handling ParameterDeclarations logic
        handleParameterDeclaration(node, newClassInfo);
      } else if (node.getKind() === SyntaxKind.PropertyDeclaration) {
        // Handling PropertyDeclarations logic
        updatePropertyDeclaration(node, newClassInfo);
        handlePropertyInConstructor(node, newClassInfo);
      }
    }
  });
}

function updatePropertyDeclaration(
  propertyDeclaration: PropertyDeclaration,
  newClassInfo: NewClassInfo
) {
  const fieldName = propertyDeclaration.getName();
  const onlyFieldsNameUsage = fieldName + ".";

  const fieldDeclaration = propertyDeclaration.getFirstAncestorByKind(
    SyntaxKind.ClassDeclaration
  );
  if (!fieldDeclaration) {
    console.error(
      `Failed to get method declaration for: ${propertyDeclaration.getText()}`
    );
    return;
  }

  const refactoredInstance = getInstanceName(newClassInfo);
  fieldDeclaration.getMethods().forEach((method) => {
    method
      .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
      .forEach((expressionStatement) => {
        const expression = expressionStatement.getExpression();
        if (expression.getText().includes(onlyFieldsNameUsage)) {
          if (expression.getText().includes("=")) {
            const expressions = fieldDeclaration.getDescendantsOfKind(
              SyntaxKind.BinaryExpression
            );

            expressions.reverse().forEach((binaryExpression) => {
              if (binaryExpression.getText().includes(onlyFieldsNameUsage)) {
                const newExpression = processExpression(
                  binaryExpression,
                  refactoredInstance,
                  newClassInfo
                );
                binaryExpression.replaceWithText(newExpression);
              }
            });
          } else {
            updateWithGetterUsingInstance(
              expressionStatement,
              refactoredInstance,
              newClassInfo,
              fieldName,
              true
            );
          }
        }
      });
  });
}

function handlePropertyInConstructor(
  propertyDeclaration: PropertyDeclaration,
  newClassInfo: NewClassInfo
) {
  const fieldName = propertyDeclaration.getName();
  const classDeclaration = propertyDeclaration.getFirstAncestorByKind(
    SyntaxKind.ClassDeclaration
  );

  if (!classDeclaration) {
    console.error(
      `Failed to get class declaration for: ${propertyDeclaration.getText()}`
    );
    return;
  }

  const constructorDeclaration = classDeclaration.getConstructors()[0];
  if (!constructorDeclaration) {
    // No constructor, nothing to modify
    return;
  }

  const refactoredInstance = getInstanceName(newClassInfo);

  constructorDeclaration
    .getBody()
    .getDescendantStatements()
    .filter(
      (statement) => statement.getKind() === SyntaxKind.ExpressionStatement
    )
    .forEach((statement) => {
      if (statement.getText().includes(fieldName)) {
        refactorCallsInConstructor(
          statement,
          fieldName,
          refactoredInstance,
          newClassInfo
        );
      }
    });
}

function refactorCallsInConstructor(
  statement,
  fieldName,
  refactoredInstance,
  newClassInfo
) {
  const onlyFieldsNameUsage = fieldName + ".";
  statement.getDescendants().forEach((descendant) => {
    if (descendant instanceof BinaryExpression) {
      const expressions = descendant.getDescendantsOfKind(
        SyntaxKind.BinaryExpression
      );

      expressions.reverse().forEach((binaryExpression) => {
        if (binaryExpression.getText().includes(onlyFieldsNameUsage)) {
          const newExpression = processExpression(
            binaryExpression,
            refactoredInstance,
            newClassInfo
          );
          binaryExpression.replaceWithText(newExpression);
        }
      });
    } else {
      if (
        descendant instanceof PropertyAccessExpression &&
        descendant.getText().includes(onlyFieldsNameUsage)
      ) {
        const accessedPropertyName = descendant.getName();
        descendant.replaceWithText(
          `this.${fieldName}.${refactoredInstance}.get${toCamelCase(
            accessedPropertyName
          )}()`
        );
      }
    }
  });
}

function handleParameterDeclaration(
  parameterDeclaration: ParameterDeclaration,
  newClassInfo: NewClassInfo
) {
  const parameterName = parameterDeclaration.getName();
  const methodDeclaration = parameterDeclaration.getFirstAncestorByKind(
    SyntaxKind.MethodDeclaration
  );
  if (!methodDeclaration) {
    console.error(
      `Failed to get method declaration for: ${parameterDeclaration.getText()}`
    );
    return;
  }

  const refactoredInstance = getInstanceName(newClassInfo);
  methodDeclaration
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();
      if (expression.getText().includes(parameterName)) {
        if (expression.getText().includes("=")) {
          const expressions = methodDeclaration.getDescendantsOfKind(
            SyntaxKind.BinaryExpression
          );

          expressions.reverse().forEach((binaryExpression) => {
            if (binaryExpression.getText().includes(parameterName)) {
              const newExpression = processBinaryExpression(
                binaryExpression,
                refactoredInstance,
                newClassInfo,
                parameterName
              );
              binaryExpression.replaceWithText(newExpression);
            }
          });
        } else {
          updateWithGetterUsingInstance(
            expressionStatement,
            refactoredInstance,
            newClassInfo,
            parameterName,
            false
          );
        }
      }
    });
}

function extractArguments(
  args: Node[],
  classFields: ParameterInfo[]
): [string[], string[]] {
  let newClassArguments: string[] = [];
  let otherArguments: string[] = [];
  let classFieldTypes = classFields.map((param) => param.type);

  let argumentsList = [...args]; // clone the args array to avoid side-effects

  for (let type of classFieldTypes) {
    let foundIndex = argumentsList.findIndex(
      (arg) => getArgumentType(arg) === type
    );
    if (foundIndex !== -1) {
      newClassArguments.push(argumentsList[foundIndex].getText());
      argumentsList.splice(foundIndex, 1); // Remove the found argument to avoid duplication
    } else {
      newClassArguments.push("undefined");
    }
  }

  otherArguments = argumentsList.map((arg) => arg.getText());

  return [newClassArguments, otherArguments];
}

function constructAndUpdateRefactoredClassReferenceName(
  newExpression: NewExpression,
  extractedClassName: string,
  newClassArguments: string[],
  otherArguments: string[]
) {
  const newInstanceCreation = `new ${extractedClassName}( ${newClassArguments.join(
    ", "
  )})`;
  const refactorClassReferenceName = newExpression.getExpression().getText();
  const newArgumentsText = [newInstanceCreation, ...otherArguments].join(", ");
  newExpression.replaceWithText(
    `new ${refactorClassReferenceName}(${newArgumentsText})`
  );
}

function updateInstanceArguments(
  newExpression: NewExpression,
  newClassInfo: NewClassInfo,
  args: Node[]
) {
  const [newClassArguments, otherArguments] = extractArguments(
    args,
    newClassInfo.parameters
  );
  constructAndUpdateRefactoredClassReferenceName(
    newExpression,
    newClassInfo.className,
    newClassArguments,
    otherArguments
  );
  updateInstanceUsage(newExpression, newClassInfo);
}

function updateInstanceUsage(
  newExpression: NewExpression,
  newClassInfo: NewClassInfo
) {
  const instanceName = newExpression
    .getParentIfKind(SyntaxKind.VariableDeclaration)
    ?.getName();
  if (!instanceName) {
    console.error(
      `Failed to get instance name for: ${newExpression.getText()}`
    );
    return;
  }
  console.log(`Instance name: ${instanceName}  `);

  const methodDeclaration = newExpression.getFirstAncestorByKind(
    SyntaxKind.MethodDeclaration
  );
  if (!methodDeclaration) {
    console.error(
      `Failed to get method declaration for: ${newExpression.getText()}`
    );
    return;
  }
  const refactoredInstance = getInstanceName(newClassInfo);

  methodDeclaration
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression.getText().includes("=")) {
        const expressions = methodDeclaration.getDescendantsOfKind(
          SyntaxKind.BinaryExpression
        );
        expressions.reverse().forEach((binaryExpression) => {
          if (binaryExpression.getText().includes(instanceName)) {
            const newExpression = processBinaryExpression(
              binaryExpression,
              refactoredInstance,
              newClassInfo,
              instanceName
            );
            binaryExpression.replaceWithText(newExpression);
          }
        });
      } else {
        updateWithGetterUsingInstance(
          expressionStatement,
          refactoredInstance,
          newClassInfo,
          instanceName,
          false
        );
      }
    });
}

function processBinaryExpression(
  binaryExpression: BinaryExpression,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string
): string {
  const left = binaryExpression.getLeft();
  const right = binaryExpression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    rightText = processBinaryExpression(
      right,
      refactoredInstance,
      newClassInfo,
      instanceName
    );
  }

  const assignment =
    binaryExpression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;

  if (assignment) {
    if (
      left instanceof PropertyAccessExpression &&
      left.getText().includes(instanceName)
    ) {
      const propertyName = left.getName();
      leftText = `${instanceName}.${refactoredInstance}.set${toCamelCase(
        propertyName
      )}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      right.getText().includes(instanceName)
    ) {
      rightText = processPropertyAccessExpression(
        right,
        refactoredInstance,
        newClassInfo,
        instanceName,
        false
      );
    }
    let result = `${leftText}(${rightText})`;

    return result;
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      left.getText().includes(instanceName)
    ) {
      leftText = processPropertyAccessExpression(
        left,
        refactoredInstance,
        newClassInfo,
        instanceName,
        false
      );
    }
    if (
      right instanceof PropertyAccessExpression &&
      right.getText().includes(instanceName)
    ) {
      rightText = processPropertyAccessExpression(
        right,
        refactoredInstance,
        newClassInfo,
        instanceName,
        false
      );
    }
    // // Check for CallExpression
    // if (left instanceof CallExpression) {
    //   leftText = processCallExpression(
    //     left,
    //     refactoredInstance,
    //     newClassInfo,
    //     instanceName
    //   );
    // }
    // if (right instanceof CallExpression) {
    //   rightText = processCallExpression(
    //     right,
    //     refactoredInstance,
    //     newClassInfo,
    //     instanceName
    //   );
    // }
    const result = `${leftText} ${binaryExpression
      .getOperatorToken()
      .getText()} ${rightText}`;
    console.log("result11 :     ", result);

    return result;
  }
}

function updateWithGetterUsingInstance(
  expressionStatement: ExpressionStatement,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string,
  usesThis: boolean
): void {
  const expression = expressionStatement.getExpression();
  if (expression instanceof BinaryExpression) {
    // Handle BinaryExpression
    const updatedBinaryExpression = processBinaryExpression(
      expression,
      refactoredInstance,
      newClassInfo,
      instanceName
    );
    expressionStatement.replaceWithText(updatedBinaryExpression);
  } else if (expression instanceof CallExpression) {
    const updatedCall = processCallExpression(
      expression,
      refactoredInstance,
      newClassInfo,
      instanceName
    );
    expressionStatement.replaceWithText(updatedCall);
  } else if (expression instanceof PropertyAccessExpression) {
    const updatedPropertyAccess = processPropertyAccessExpression(
      expression,
      refactoredInstance,
      newClassInfo,
      instanceName,
      usesThis
    );
    expressionStatement.replaceWithText(updatedPropertyAccess);
  }
}

function processCallExpression(
  call: CallExpression,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string
): string {
  const identifier = call.getExpression();
  let result = call.getText();
  if (identifier instanceof CallExpression) {
    return processCallExpression(
      identifier,
      refactoredInstance,
      newClassInfo,
      instanceName
    );
  }
  if (call.getArguments().some((arg) => arg.getText().includes(instanceName))) {
    const updatedArguments = updateCallArguments(
      call.getArguments(),
      instanceName,
      refactoredInstance,
      newClassInfo
    );
    result = `${identifier.getText()}(${updatedArguments.join(", ")})`;
  } else if (identifier instanceof PropertyAccessExpression) {
    const parentExpression = identifier.getExpression();
    const propName = identifier.getName();

    if (
      parentExpression instanceof PropertyAccessExpression &&
      (parentExpression.getExpression().getText() === instanceName ||
        parentExpression.getExpression().getText() === `this.${instanceName}`)
    ) {
      result = `${parentExpression
        .getExpression()
        .getText()}.${refactoredInstance}.get${toCamelCase(
        parentExpression.getName()
      )}().${propName}()`;
    }
  }

  return result;
}

function updateCallArguments(
  argumentsArray: any[],
  instanceName: string,
  refactoredInstance: string,
  newClassInfo: NewClassInfo
) {
  return argumentsArray.map((arg) => {
    if (arg.getText().includes(instanceName)) {
      const matches = arg
        .getText()
        .match(new RegExp(`${instanceName}\\.([a-zA-Z0-9_]+)`));
      if (
        matches &&
        matches[1] &&
        parameterExists(matches[1], newClassInfo.parameters)
      ) {
        return `${instanceName}.${refactoredInstance}.get${toCamelCase(
          matches[1]
        )}()`;
      }
    }
    return arg.getText();
  });
}

function processPropertyAccessExpression(
  expression: PropertyAccessExpression,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string,
  usesThis: boolean
): string {
  const propName = expression.getName();
  if (
    parameterExists(propName, newClassInfo.parameters) &&
    expression.getText().includes(instanceName)
  ) {
    return replacePropertyAccess(
      usesThis,
      expression,
      instanceName,
      refactoredInstance
    );
  }
  return expression.getText(); // If conditions don't match, return the original text.
}
