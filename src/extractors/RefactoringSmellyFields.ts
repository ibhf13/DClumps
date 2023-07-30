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
  extractedClassInfo: NewClassInfo,
  leastParameterField: SmellyFields,
  smellyFieldGroup: DataClumpsList,
  project: Project
) {
  refactorSelectedClassFields(extractedClassInfo, leastParameterField, project);
  const fieldGroupCopy = removeSelectedField(
    leastParameterField,
    smellyFieldGroup
  );

  for (const field of fieldGroupCopy) {
    refactorSelectedClassFields(extractedClassInfo, field, project);
  }

  project.saveSync();
}
//To be extracted
function removeSelectedField(
  smellyFieldGroup: SmellyFields,
  methodGroupCopy: DataClumpsList
): SmellyFields[] {
  return methodGroupCopy.smellyFieldGroup.filter(
    (field) => field !== smellyFieldGroup
  );
}

function refactorSelectedClassFields(
  extractedClassInfo: NewClassInfo,
  refactoredField: SmellyFields,
  project: Project
) {
  const sourceFile = project.addSourceFileAtPath(
    refactoredField.classInfo.filepath
  );

  importNewClass(sourceFile, extractedClassInfo);

  const refactoredClass = sourceFile.getClass(
    refactoredField.classInfo.className
  );

  const extractedClassName = getInstanceName(extractedClassInfo);

  const sharedFields = getSharedFields(extractedClassInfo, refactoredClass);
  updateFieldsInClass(extractedClassInfo, refactoredClass);

  refactoredClass.getMethods().forEach((method) => {
    refactorMethodBody(
      method,
      extractedClassInfo,
      sharedFields,
      extractedClassName
    );
  });

  if (refactoredField.callsInfo.callsList.callsInSame > 0) {
    findInstancesOfRefactoredClass(
      project,
      refactoredField.classInfo.filepath,
      refactoredClass,
      extractedClassInfo
    );
  }

  const globalCalls: GlobalCalls[] =
    refactoredField.callsInfo.callsList.callsGlob;
  globalCalls.forEach((call) => {
    project.saveSync();
    findInstancesOfRefactoredClass(
      project,
      call.classInfo.filepath,
      refactoredClass,
      extractedClassInfo
    );
  });
  sourceFile.formatText();
  project.saveSync();
}

function createExtractedClassInstance(
  extractedClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  sharedParameters: string[]
) {
  const extractedClassName = getInstanceName(extractedClassInfo);
  const instanceParams = sharedParameters.map(
    (param) =>
      extractedClassInfo.parameters.find((p) => p.name === param)?.value ||
      "undefined"
  );

  const instanceParamsStr = instanceParams.join(", ");

  classToRefactor.insertProperty(0, {
    name: extractedClassName,
    type: extractedClassInfo.className,
    initializer: `new ${extractedClassInfo.className}(${instanceParamsStr})`,
  });

  return extractedClassName;
}

function updateFieldsInClass(
  extractedClassInfo: NewClassInfo,
  refactoredClass: ClassDeclaration
): string[] {
  const sharedParameters = getSharedFields(extractedClassInfo, refactoredClass);
  removeSharedProperties(refactoredClass, sharedParameters);
  const extractedClassInstanceName = createExtractedClassInstance(
    extractedClassInfo,
    refactoredClass,
    sharedParameters
  );
  refactorConstructor(
    extractedClassInfo,
    refactoredClass,
    extractedClassInstanceName,
    sharedParameters
  );

  return sharedParameters;
}

function replaceConstructorAssignments(
  constructor: ConstructorDeclaration,
  sharedParameters: string[],
  instanceName: string
) {
  let leftText: string;
  let rightText: string;

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
        leftText = left.getText();
        rightText = right.getText();
        if (
          left instanceof PropertyAccessExpression &&
          left.getExpression().getKind() === SyntaxKind.ThisKeyword &&
          sharedParameters.includes(left.getName())
        ) {
          leftText = `this.${instanceName}.set${toCamelCase(left.getName())}`;
        }
        if (
          right instanceof Identifier &&
          sharedParameters.includes(right.getText())
        ) {
          rightText = `this.${instanceName}.get${toCamelCase(
            right.getText()
          )}()`;
        }
        if (
          left instanceof PropertyAccessExpression &&
          left.getExpression().getKind() === SyntaxKind.ThisKeyword &&
          sharedParameters.includes(left.getName())
        ) {
          binaryExpression.replaceWithText(`${leftText}(${rightText})`);
        } else {
          binaryExpression.replaceWithText(`${leftText} = ${rightText}`);
        }
      }
    });
}

function replaceConstructorParameters(
  constructor: ConstructorDeclaration,
  extractedClassInfo: NewClassInfo,
  sharedParameters: string[]
) {
  constructor.getParameters().forEach((param) => {
    if (sharedParameters.includes(param.getName())) {
      param.remove();
    }
  });
  constructor.insertParameter(0, {
    name: getInstanceName(extractedClassInfo),
    type: extractedClassInfo.className,
  });
}

function refactorConstructor(
  extractedClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  instanceName: string,
  sharedParameters: string[]
) {
  const constructor = classToRefactor.getConstructors()[0];
  if (!constructor) return;

  // Replace the parameters of the constructor
  replaceConstructorParameters(
    constructor,
    extractedClassInfo,
    sharedParameters
  );

  // Replace the assignments in the constructor body
  replaceConstructorAssignments(constructor, sharedParameters, instanceName);
}

function refactorMethodBody(
  method: MethodDeclaration,
  extractedClassInfo: NewClassInfo,
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
            processBinaryExpressionForFields(
              binaryExpression,
              instance,
              sharedParameters,
              extractedClassInfo
            );
          }
        });
      } else if (expression instanceof PropertyAccessExpression) {
        if (
          parameterExists(
            expression.getName(),
            extractedClassInfo.parameters
          ) &&
          expression.getExpression().getKind() === SyntaxKind.ThisKeyword
        ) {
          const updateText = `this.${instance}.get${toCamelCase(
            expression.getName()
          )}()`;
          expression.replaceWithText(updateText);
        }
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

function processBinaryExpressionForFields(
  expression: BinaryExpression,
  instance: string,
  sharedParameters: string[],
  extractedClassInfo: NewClassInfo
) {
  const left = expression.getLeft();
  const right = expression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    processBinaryExpressionForFields(
      right,
      instance,
      sharedParameters,
      extractedClassInfo
    );
  }

  //Check if the left and right expressions contain 'this' or another instance name

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;

  if (assignment) {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), extractedClassInfo.parameters) &&
      left.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      leftText = `this.${instance}.set${toCamelCase(left.getName())}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), extractedClassInfo.parameters) &&
      right.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    let result = `${leftText}(${rightText})`;

    expression.replaceWithText(result);
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), extractedClassInfo.parameters) &&
      left.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      leftText = `this.${instance}.get${toCamelCase(left.getName())}()`;
      left.replaceWithText(leftText);
    } else {
      updateGetterCalls(left, sharedParameters, instance);
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), extractedClassInfo.parameters) &&
      right.getExpression().getKind() !== SyntaxKind.Identifier
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
      right.replaceWithText(rightText);
    } else {
      updateGetterCalls(right, sharedParameters, instance);
    }

    const result = `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

function replacePropertyAccess(
  isThisReq: boolean,
  expression: PropertyAccessExpression,
  instanceName: string,
  extractedClassInstanceName: string
): string {
  const propName = expression.getName();
  if (isThisReq) {
    return `this.${instanceName}.${extractedClassInstanceName}.get${toCamelCase(
      propName
    )}()`;
  }
  return `${instanceName}.${extractedClassInstanceName}.get${toCamelCase(
    propName
  )}()`;
}

function findInstancesOfRefactoredClass(
  project: Project,
  filepath: string,
  refactoredClass: ClassDeclaration,
  extractedClassInfo: NewClassInfo
) {
  const sourceFile = project.addSourceFileAtPath(filepath);
  const className = refactoredClass.getName();

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression),
    (node) => node.getExpression().getText() === className,
    extractedClassInfo
  );

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.Parameter),
    (node) => node.getText().includes(className),
    extractedClassInfo
  );

  refactorNodes(
    sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration),
    (node) => node.getText().includes(className),
    extractedClassInfo
  );
  sourceFile.formatText();
  project.saveSync();
}
//checkFn : check fields name
function refactorNodes(nodes, checkFn, extractedClassInfo) {
  nodes.forEach((node) => {
    if (checkFn(node)) {
      if (node.getKind() === SyntaxKind.NewExpression) {
        // Handling NewExpressions logic
        const args = node.getArguments();
        if (args.length > 0) {
          //refactoredClassReferenceWithConstructor
          updateInstanceArguments(node, extractedClassInfo, args);
        } else {
          //refactoredClassReferenceWithout
          updateInstanceUsage(node, extractedClassInfo);
        }
      } else if (node.getKind() === SyntaxKind.Parameter) {
        // Handling ParameterDeclarations logic
        handleParameterDeclaration(node, extractedClassInfo);
      } else if (node.getKind() === SyntaxKind.PropertyDeclaration) {
        // Handling PropertyDeclarations logic
        updatePropertyDeclaration(node, extractedClassInfo);
        handlePropertyInConstructor(node, extractedClassInfo);
      }
    }
  });
}

function updatePropertyDeclaration(
  propertyDeclaration: PropertyDeclaration,
  extractedClassInfo: NewClassInfo
) {
  const sharedParameters = extractedClassInfo.parameters.map(
    (param) => param.name
  );
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

  const extractedClassInstanceName = getInstanceName(extractedClassInfo);
  fieldDeclaration.getMethods().forEach((method) => {
    method
      .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
      .forEach((expressionStatement) => {
        const expression = expressionStatement.getExpression();
        if (expression.getText().includes(onlyFieldsNameUsage)) {
          if (expression instanceof BinaryExpression) {
            const expressions = fieldDeclaration.getDescendantsOfKind(
              SyntaxKind.BinaryExpression
            );

            expressions.reverse().forEach((binaryExpression) => {
              if (binaryExpression.getText().includes(onlyFieldsNameUsage)) {
                processBinaryExpression(
                  binaryExpression,
                  extractedClassInstanceName,
                  extractedClassInfo,
                  fieldName,
                  true
                );
              }
            });
          } else if (expression instanceof PropertyAccessExpression) {
            const updatedPropertyAccess = processPropertyAccessExpression(
              expression,
              extractedClassInstanceName,
              extractedClassInfo,
              fieldName,
              true
            );
            expressionStatement.replaceWithText(updatedPropertyAccess);
          } else {
            updateWithGetter(
              expression,
              extractedClassInstanceName,
              extractedClassInfo,
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
  extractedClassInfo: NewClassInfo
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

  const extractedClassInstanceName = getInstanceName(extractedClassInfo);

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
          extractedClassInstanceName,
          extractedClassInfo
        );
      }
    });
}

function refactorCallsInConstructor(
  statement,
  fieldName,
  extractedClassInstanceName,
  extractedClassInfo
) {
  const sharedParameters = extractedClassInfo.parameters.map(
    (param) => param.name
  );
  const onlyFieldsNameUsage = fieldName + ".";
  statement.getDescendants().forEach((descendant) => {
    if (descendant instanceof BinaryExpression) {
      const expressions = descendant.getDescendantsOfKind(
        SyntaxKind.BinaryExpression
      );

      expressions.reverse().forEach((binaryExpression) => {
        if (binaryExpression.getText().includes(onlyFieldsNameUsage)) {
          processBinaryExpressionForFields(
            binaryExpression,
            fieldName,
            sharedParameters,
            extractedClassInfo
          );
        }
      });
    } else {
      if (
        descendant instanceof PropertyAccessExpression &&
        descendant.getText().includes(onlyFieldsNameUsage)
      ) {
        const accessedPropertyName = descendant.getName();
        descendant.replaceWithText(
          `this.${fieldName}.${extractedClassInstanceName}.get${toCamelCase(
            accessedPropertyName
          )}()`
        );
      }
    }
  });
}

function handleParameterDeclaration(
  parameterDeclaration: ParameterDeclaration,
  extractedClassInfo: NewClassInfo
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

  const extractedClassInstanceName = getInstanceName(extractedClassInfo);
  methodDeclaration
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();
      if (expression.getText().includes(parameterName)) {
        if (expression instanceof BinaryExpression) {
          const expressions = methodDeclaration.getDescendantsOfKind(
            SyntaxKind.BinaryExpression
          );

          expressions.reverse().forEach((binaryExpression) => {
            if (binaryExpression.getText().includes(parameterName)) {
              processBinaryExpression(
                binaryExpression,
                extractedClassInstanceName,
                extractedClassInfo,
                parameterName,
                false
              );
            }
          });
        } else if (expression instanceof PropertyAccessExpression) {
          const updatedPropertyAccess = processPropertyAccessExpression(
            expression,
            extractedClassInstanceName,
            extractedClassInfo,
            parameterName,
            false
          );
          expressionStatement.replaceWithText(updatedPropertyAccess);
        } else {
          updateWithGetter(
            expression,
            extractedClassInstanceName,
            extractedClassInfo,
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
  extractedClassInfo: NewClassInfo,
  args: Node[]
) {
  const [newClassArguments, otherArguments] = extractArguments(
    args,
    extractedClassInfo.parameters
  );
  constructAndUpdateRefactoredClassReferenceName(
    newExpression,
    extractedClassInfo.className,
    newClassArguments,
    otherArguments
  );
  updateInstanceUsage(newExpression, extractedClassInfo);
}

function updateInstanceUsage(
  newExpression: NewExpression,
  extractedClassInfo: NewClassInfo
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
  const methodDeclaration = newExpression.getFirstAncestorByKind(
    SyntaxKind.MethodDeclaration
  );
  if (!methodDeclaration) {
    console.error(
      `Failed to get method declaration for: ${newExpression.getText()}`
    );
    return;
  }
  const extractedClassInstanceName = getInstanceName(extractedClassInfo);

  methodDeclaration
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression instanceof BinaryExpression) {
        const expressions = methodDeclaration.getDescendantsOfKind(
          SyntaxKind.BinaryExpression
        );
        expressions.reverse().forEach((binaryExpression) => {
          if (binaryExpression.getText().includes(instanceName)) {
            processBinaryExpression(
              binaryExpression,
              extractedClassInstanceName,
              extractedClassInfo,
              instanceName,
              false
            );
          }
        });
      } else if (expression instanceof PropertyAccessExpression) {
        const updatedPropertyAccess = processPropertyAccessExpression(
          expression,
          extractedClassInstanceName,
          extractedClassInfo,
          instanceName,
          false
        );
        expressionStatement.replaceWithText(updatedPropertyAccess);
      } else {
        updateWithGetter(
          expression,
          extractedClassInstanceName,
          extractedClassInfo,
          instanceName,
          false
        );
      }
    });
}

function updateWithGetter(
  expression: Expression,
  extractedClassInstanceName: string,
  extractedClassInfo: NewClassInfo,
  instanceName: string,
  usesThis: boolean
) {
  const propertyAccessesToUpdate = expression
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((propertyAccess) => {
      return (
        parameterExists(
          propertyAccess.getName(),
          extractedClassInfo.parameters
        ) && propertyAccess.getText().includes(instanceName)
      );
    });

  propertyAccessesToUpdate.forEach((propertyAccess) => {
    const updateText = replacePropertyAccess(
      usesThis,
      propertyAccess,
      instanceName,
      extractedClassInstanceName
    );

    propertyAccess.replaceWithText(updateText);
  });
}

function processBinaryExpression(
  binaryExpression: BinaryExpression,
  extractedClassInstanceName: string,
  extractedClassInfo: NewClassInfo,
  instanceName: string,
  usingThis: boolean
) {
  const left = binaryExpression.getLeft();
  const right = binaryExpression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  if (right instanceof BinaryExpression) {
    processBinaryExpression(
      right,
      extractedClassInstanceName,
      extractedClassInfo,
      instanceName,
      usingThis
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
      leftText = `${instanceName}.${extractedClassInstanceName}.set${toCamelCase(
        propertyName
      )}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      right.getText().includes(instanceName)
    ) {
      rightText = processPropertyAccessExpression(
        right,
        extractedClassInstanceName,
        extractedClassInfo,
        instanceName,
        usingThis
      );
    }
    let result = `${leftText}(${rightText})`;
    binaryExpression.replaceWithText(result);
  } else {
    if (
      right instanceof PropertyAccessExpression &&
      right.getText().includes(instanceName)
    ) {
      rightText = processPropertyAccessExpression(
        right,
        extractedClassInstanceName,
        extractedClassInfo,
        instanceName,
        usingThis
      );
      right.replaceWithText(rightText);
    } else {
      updateWithGetter(
        right,
        extractedClassInstanceName,
        extractedClassInfo,
        instanceName,
        usingThis
      );
    }
    if (
      left instanceof PropertyAccessExpression &&
      left.getText().includes(instanceName)
    ) {
      leftText = processPropertyAccessExpression(
        left,
        extractedClassInstanceName,
        extractedClassInfo,
        instanceName,
        usingThis
      );
      left.replaceWithText(leftText);
    } else {
      updateWithGetter(
        left,
        extractedClassInstanceName,
        extractedClassInfo,
        instanceName,
        usingThis
      );
    }
  }
}

function processPropertyAccessExpression(
  expression: PropertyAccessExpression,
  extractedClassInstanceName: string,
  extractedClassInfo: NewClassInfo,
  instanceName: string,
  usesThis: boolean
): string {
  const propName = expression.getName();
  if (
    parameterExists(propName, extractedClassInfo.parameters) &&
    expression.getText().includes(instanceName)
  ) {
    return replacePropertyAccess(
      usesThis,
      expression,
      instanceName,
      extractedClassInstanceName
    );
  }
  return expression.getText(); // If conditions don't match, return the original text.
}
