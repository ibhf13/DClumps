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
  ConstructorDeclaration,
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
    findInstancesOfRefactoredClass(
      project,
      refactoredField.classInfo.filepath,
      classToRefactor,
      newClassInfo
    );
  });

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

function parameterExists(
  paramName: string,
  newClassParams: ParameterInfo[]
): boolean {
  return newClassParams.some((param) => param.name === paramName);
}

function getSharedParameters(
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

  newClassInfo.parameters.forEach((param) => {
    if (currentClassParameters.has(param.name)) {
      sharedParameters.push(param.name);
    }
  });
  return sharedParameters;
}

function refactorClassProperties(
  classToRefactor: ClassDeclaration,
  sharedParameters: string[]
) {
  sharedParameters.forEach((param) => {
    const property = classToRefactor.getProperty(param);
    property?.remove();
  });
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
  const sharedParameters = getSharedParameters(newClassInfo, classToRefactor);
  refactorClassProperties(classToRefactor, sharedParameters);
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
  classToRefactor: ClassDeclaration,
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
  const refactoredInstance = getInstanceName(newClassInfo);
  console.log(`Refactored Instance name: ${refactoredInstance}`);

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
            const newExpression = processExpressionForCalls(
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
          instanceName
        );
      }
    });
}

function processExpressionForCalls(
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
    rightText = processExpressionForCalls(
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
      const propertyName = right.getName();
      rightText = `${instanceName}.${refactoredInstance}.get${toCamelCase(
        propertyName
      )}()`;
    }
    let result = `${leftText}(${rightText})`;

    return result;
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      left.getText().includes(instanceName)
    ) {
      const propertyName = left.getName();
      leftText = `${instanceName}.${refactoredInstance}.get${toCamelCase(
        propertyName
      )}()`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      right.getText().includes(instanceName)
    ) {
      const propertyName = right.getName();
      rightText = `${instanceName}.${refactoredInstance}.get${toCamelCase(
        propertyName
      )}()`;
    }

    const result = `${leftText} ${binaryExpression
      .getOperatorToken()
      .getText()} ${rightText}`;

    return result;
  }
}

function updateWithGetterUsingInstance(
  expressionStatement: ExpressionStatement,
  refactoredInstance: string,
  newClassInfo: NewClassInfo,
  instanceName: string
) {
  const expression = expressionStatement.getExpression();

  if (expression instanceof CallExpression) {
    const call = expression as CallExpression;
    const identifier = call.getExpression();

    if (
      call.getArguments().some((arg) => arg.getText().includes(instanceName))
    ) {
      const updatedArguments = call.getArguments().map((arg) => {
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
      call.replaceWithText(
        `${identifier.getText()}(${updatedArguments.join(", ")})`
      );
    } else if (identifier instanceof PropertyAccessExpression) {
      const propName = identifier.getName();
      if (identifier.getText().includes(instanceName)) {
        const updatedExpression = `${instanceName}.${refactoredInstance}.${propName}()`;
        call.replaceWithText(updatedExpression);
      }
    }
  } else if (expression instanceof PropertyAccessExpression) {
    const propName = expression.getName();
    if (
      parameterExists(propName, newClassInfo.parameters) &&
      expression.getText().includes(instanceName)
    ) {
      const updatedExpression = `${instanceName}.${refactoredInstance}.get${toCamelCase(
        propName
      )}()`;
      expression.replaceWithText(updatedExpression);
    }
  }
}
