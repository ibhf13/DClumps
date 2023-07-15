import {
  BinaryExpression,
  Block,
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
  ts,
  CallExpression,
} from "ts-morph";
import * as path from "path";
import {
  DataClumpsList,
  NewClassInfo,
  ParameterInfo,
  SmellyFields,
} from "../utils/Interfaces";

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

function refactorSelectedClassFields(
  newClassInfo: NewClassInfo,
  refactoredField: SmellyFields,
  project: Project
) {
  const sourceFile = project.addSourceFileAtPath(
    refactoredField.classInfo.filepath
  );

  importNewClass(sourceFile, newClassInfo);

  const classToRefactor = sourceFile.getClass(
    refactoredField.classInfo.className
  );
  const instanceName = getInstanceName(newClassInfo);

  const sharedParameters = updateFieldsInClass(newClassInfo, classToRefactor);

  classToRefactor.getMethods().forEach((method) => {
    refactorMethodBody(
      method,
      newClassInfo,
      classToRefactor,
      sharedParameters,
      instanceName
    );
  });

  findInstancesOfRefactoredClass(
    project,
    refactoredField.classInfo.filepath,
    classToRefactor,
    newClassInfo
  );
  project.saveSync();
}

function toCamelCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getInstanceName(newClassInfo: NewClassInfo) {
  const instance = `${newClassInfo.className
    .charAt(0)
    .toLowerCase()}${newClassInfo.className.slice(1)}Instance`;
  return instance;
}

function getInstanceNameforCalls(newClassInfo: NewClassInfo) {
  const instance = `${newClassInfo.className
    .charAt(0)
    .toLowerCase()}${newClassInfo.className.slice(1)}`;
  return instance;
}

function parameterExists(
  paramName: string,
  newClassParams: ParameterInfo[]
): boolean {
  return newClassParams.some((param) => param.name === paramName);
}

function updateFieldsInClass(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration
): string[] {
  const sharedParameters: string[] = [];

  const currentClassParameters = new Map(
    classToRefactor
      .getProperties()
      .map((property) => [
        property.getName(),
        property.getInitializer()?.getText() || "undefined",
      ])
  );

  const instanceParams = newClassInfo.parameters.map((param) => {
    if (currentClassParameters.has(param.name)) {
      sharedParameters.push(param.name);
      return currentClassParameters.get(param.name);
    }
    return "undefined";
  });
  const instanceName = getInstanceName(newClassInfo);
  refactorConstructor(
    newClassInfo,
    classToRefactor,
    instanceName,
    sharedParameters
  );
  sharedParameters.forEach((param) => {
    const property = classToRefactor.getProperty(param);
    property?.remove();
  });

  const instanceParamsStr = instanceParams.join(", ");

  classToRefactor.insertProperty(0, {
    name: instanceName,
    type: newClassInfo.className,
    initializer: `new ${newClassInfo.className}(${instanceParamsStr})`,
  });

  return sharedParameters;
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
  constructor.getParameters().forEach((param) => {
    if (sharedParameters.includes(param.getName())) {
      param.remove();
    }
  });
  constructor.insertParameter(0, {
    name: instanceName,
    type: newClassInfo.className,
  });

  // Replace the assignments in the constructor body
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

function refactorMethodBody(
  method: MethodDeclaration,
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  sharedParameters: string[],
  instance: string
) {
  const expressions = method.getDescendantsOfKind(SyntaxKind.BinaryExpression);

  const classPropertyNames = classToRefactor
    .getProperties()
    .map((prop) => prop.getName());

  method
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .forEach((expressionStatement) => {
      const expression = expressionStatement.getExpression();

      if (expression instanceof BinaryExpression) {
        expressions.reverse().forEach((binaryExpression) => {
          const left = binaryExpression.getLeft();
          const right = binaryExpression.getRight();

          // Only refactor expressions that are related to the class that is being refactored
          if (
            (left instanceof PropertyAccessExpression &&
              classPropertyNames.includes(left.getName())) ||
            (right instanceof PropertyAccessExpression &&
              classPropertyNames.includes(right.getName()))
          ) {
            const newExpression = processExpression(
              binaryExpression,
              instance,
              newClassInfo
            );
            binaryExpression.replaceWithText(newExpression);
          }
        });
      }
      updateWithGetter(classToRefactor, sharedParameters, instance);
    });
}

function updateWithGetter(
  classToRefactor: ClassDeclaration,
  sharedParameters: string[],
  instanceName: string
) {
  classToRefactor
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
  let left = expression.getLeft();
  let right = expression.getRight();
  let leftText = left.getText();
  let rightText = right.getText();

  // Handle nested expressions recursively
  if (right instanceof BinaryExpression) {
    rightText = processExpression(right, instance, newClassInfo);
  }

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;

  if (assignment) {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), newClassInfo.parameters) &&
      left.getExpression().getKind() === SyntaxKind.ThisKeyword
    ) {
      leftText = `this.${instance}.set${toCamelCase(left.getName())}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters) &&
      right.getExpression().getKind() === SyntaxKind.ThisKeyword
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    return `${leftText}(${rightText})`;
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), newClassInfo.parameters) &&
      left.getExpression().getKind() === SyntaxKind.ThisKeyword
    ) {
      leftText = `this.${instance}.get${toCamelCase(left.getName())}()`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters) &&
      right.getExpression().getKind() === SyntaxKind.ThisKeyword
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    return `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

// 1. Create a function to find the instances of the refactored class
// Function to find the instances of the refactored class
function findInstancesOfRefactoredClass(
  project: Project,
  filepath: string,
  refactoredClass: ClassDeclaration,
  newClassInfo: NewClassInfo
) {
  console.log(`Finding instances of refactored class in file: ${filepath}`);

  const sourceFile = project.addSourceFileAtPath(filepath);

  const newExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.NewExpression
  );

  newExpressions.forEach((newExpression) => {
    let foundInClassName = newExpression
      .getFirstAncestorByKind(SyntaxKind.ClassDeclaration)
      .getName();

    if (newExpression.getExpression().getText() === refactoredClass.getName()) {
      console.log(
        `Found instance of refactoredClass in class: ${foundInClassName} has argument ${newExpression.getText()}`
      );
      const args = newExpression.getArguments();

      if (args.length > 0) {
        // updateInstanceArguments(newExpression, newClassInfo, args, sourceFile);
      } else {
        updateInstanceUsage(newExpression, newClassInfo, sourceFile);
      }
    }
  });
}

// 2.1. Update the arguments
function updateInstanceArguments(
  newExpression: NewExpression,
  newClassInfo: NewClassInfo,
  args: Node[],
  sourceFile: SourceFile
) {
  console.log(`Updating instance arguments for: ${newExpression.getText()}`);

  // Prepare instance params string
  const instanceParams = newClassInfo.parameters
    .map((param) => {
      const argument = args.find((arg) => arg.getText() === param.name);
      return argument ? argument.getText() : "undefined";
    })
    .join(", ");

  // Replace the newExpression arguments with the prepared string
  newExpression.replaceWithText(
    `new ${newClassInfo.className}(${instanceParams})`
  );

  console.log(`Updated instance arguments to: ${newExpression.getText()}`);

  // Call updateInstanceUsage
  updateInstanceUsage(newExpression, newClassInfo, sourceFile);
}

// 2.2. Update the usage
function updateInstanceUsage(
  newExpression: NewExpression,
  newClassInfo: NewClassInfo,
  sourceFile: SourceFile
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
  console.log(`Instance name: ${instanceName}`);

  const methodDeclaration = newExpression.getFirstAncestorByKind(
    SyntaxKind.MethodDeclaration
  );
  if (!methodDeclaration) {
    console.error(
      `Failed to get method declaration for: ${newExpression.getText()}`
    );
    return;
  }

  const binaryExpressions = methodDeclaration.getDescendantsOfKind(
    SyntaxKind.BinaryExpression
  );
  const refactoredInstance = getInstanceName(newClassInfo);
  console.log(`Refactored Instance name: ${refactoredInstance}`);

  binaryExpressions.forEach((binaryExpression) => {
    const left = binaryExpression.getLeft();
    const right = binaryExpression.getRight();

    if (
      (left.getKind() === SyntaxKind.Identifier &&
        left.getText() === instanceName) ||
      (right.getKind() === SyntaxKind.Identifier &&
        right.getText() === instanceName)
    ) {
      const newExpression = processBinaryExpression(
        binaryExpression,
        refactoredInstance,
        newClassInfo,
        instanceName
      );
      binaryExpression.replaceWithText(newExpression);
      console.log(
        `Replaced expression: ${binaryExpression.getText()} with: ${newExpression}`
      );
    }
  });

  updateWithGetterUsingInstance(
    methodDeclaration,
    newClassInfo,
    refactoredInstance,
    instanceName
  );
}
function updateWithGetterUsingInstance(
  methodDeclaration: MethodDeclaration,
  newClassInfo: NewClassInfo,
  refactoredInstance: string,
  instanceName: string
) {
  methodDeclaration
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((propertyAccess) => {
      return (
        propertyAccess.getExpression().getKind() === SyntaxKind.Identifier &&
        propertyAccess.getExpression().getText() === instanceName
      );
    })
    .forEach((propertyAccess) => {
      propertyAccess.replaceWithText(
        `${instanceName}.${refactoredInstance}.get${toCamelCase(
          propertyAccess.getName()
        )}()`
      );
      console.log(
        `Replaced usage of ${instanceName} with ${refactoredInstance}`
      );
    });
}
function processBinaryExpression(
  binaryExpression: BinaryExpression,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string
): string {
  let left = binaryExpression.getLeft();
  let right = binaryExpression.getRight();
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
    console.log("-----------TEST----------------");

    if (left.getText() === instanceName) {
      console.log("-----------TEST2----------------");

      leftText = `this.${refactoredInstance}.set${toCamelCase(left.getText())}`;
    }
    if (right.getText() === instanceName) {
      console.log("-----------TEST3----------------");

      rightText = `this.${refactoredInstance}.get${toCamelCase(
        right.getText()
      )}()`;
    }
    return `${leftText}(${rightText})`;
  } else {
    if (left.getText() === instanceName) {
      console.log("-----------TEST4----------------");

      leftText = `this.${refactoredInstance}.get${toCamelCase(
        left.getText()
      )}()`;
    }
    if (right.getText() === instanceName) {
      console.log("-----------TEST5----------------");

      rightText = `this.${refactoredInstance}.get${toCamelCase(
        right.getText()
      )}()`;
    }
    return `${leftText} ${binaryExpression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

// function processCallExpression(
//   expression: BinaryExpression,
//   refactoredInstance: string,
//   newClassInfo: NewClassInfo,
//   instance
// ): string {
//   let left = expression.getLeft();
//   let right = expression.getRight();
//   let leftText = left.getText();
//   let rightText = right.getText();

//   // Handle nested expressions recursively
//   if (right instanceof BinaryExpression) {
//     rightText = processCallExpression(
//       right,
//       refactoredInstance,
//       newClassInfo,
//       instance
//     );
//   }

//   const assignment =
//     expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
//     expression.getOperatorToken().getKind() !=
//       (SyntaxKind.EqualsEqualsToken || SyntaxKind.EqualsEqualsEqualsToken);

//   if (assignment) {
//     if (left instanceof PropertyAccessExpression) {
//       leftText = `${instance}.${refactoredInstance}.set${toCamelCase(
//         left.getName()
//       )}`;
//     }
//     // Update rightText for PropertyAccessExpression
//     if (right instanceof PropertyAccessExpression) {
//       rightText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         right.getName()
//       )}()`;
//     }
//     return `${leftText}(${rightText})`;
//   } else {
//     if (left instanceof PropertyAccessExpression) {
//       leftText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         left.getName()
//       )}()`;
//     }
//     // Update rightText for PropertyAccessExpression
//     if (right instanceof PropertyAccessExpression) {
//       rightText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         right.getName()
//       )}()`;
//     }
//     return `${leftText} ${expression
//       .getOperatorToken()
//       .getText()} ${rightText}`;
//   }
// }

// function processBinaryExpression(
//   expression: BinaryExpression,
//   refactoredInstance: string,
//   newClassInfo: NewClassInfo,
//   instance
// ) {
//   const left = expression.getLeft();
//   const right = expression.getRight();
//   let leftText = left.getText();
//   let rightText = right.getText();

//   if (right instanceof BinaryExpression) {
//     rightText = processBinaryExpression(
//       right,
//       refactoredInstance,
//       newClassInfo,
//       instance
//     );
//   }
//   if (left instanceof BinaryExpression) {
//     leftText = processBinaryExpression(
//       left,
//       refactoredInstance,
//       newClassInfo,
//       instance
//     );
//   }

//   const assignment =
//     expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
//   if (assignment) {
//     if (left instanceof PropertyAccessExpression) {
//       leftText = `${instance}.${refactoredInstance}.set${toCamelCase(
//         left.getName()
//       )}`;
//     }

//     if (right instanceof PropertyAccessExpression) {
//       rightText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         rightText
//       )}()`;
//     }
//     expression.formatText();
//     return `${leftText}(${rightText})`;
//   } else {
//     if (left instanceof PropertyAccessExpression) {
//       leftText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         left.getName()
//       )}()`;
//     }
//     if (right instanceof PropertyAccessExpression) {
//       rightText = `${instance}.${refactoredInstance}.get${toCamelCase(
//         rightText
//       )}()`;
//     }
//     expression.formatText();

//     return `${leftText} ${expression
//       .getOperatorToken()
//       .getText()} ${rightText}`;
//   }
// }
