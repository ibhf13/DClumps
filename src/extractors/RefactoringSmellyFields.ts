import {
  BinaryExpression,
  Block,
  ClassDeclaration,
  Identifier,
  MethodDeclaration,
  Project,
  PropertyAccessExpression,
  SourceFile,
  SyntaxKind,
  VariableDeclaration,
  ts,
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
    refactorMethodBody(method, newClassInfo, classToRefactor, instanceName);
    updateWithGetter(classToRefactor, sharedParameters, instanceName);
  });
  //TODO identify ziel Class
  refactorOtherFiles(
    newClassInfo,
    project,
    refactoredField.classInfo.filepath,
    classToRefactor
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

  sharedParameters.forEach((param) => {
    const property = classToRefactor.getProperty(param);
    property?.remove();
  });

  const instanceName = getInstanceName(newClassInfo);

  const instanceParamsStr = instanceParams.join(", ");

  classToRefactor.insertProperty(0, {
    name: instanceName,
    type: newClassInfo.className,
    initializer: `new ${newClassInfo.className}(${instanceParamsStr})`,
  });
  return sharedParameters;
}

function refactorMethodBody(
  method: MethodDeclaration,
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  instance: string
) {
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
      parameterExists(left.getName(), newClassInfo.parameters)
    ) {
      leftText = `this.${instance}.set${toCamelCase(left.getName())}`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters)
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    return `${leftText}(${rightText})`;
  } else {
    if (
      left instanceof PropertyAccessExpression &&
      parameterExists(left.getName(), newClassInfo.parameters)
    ) {
      leftText = `this.${instance}.get${toCamelCase(left.getName())}()`;
    }
    if (
      right instanceof PropertyAccessExpression &&
      parameterExists(right.getName(), newClassInfo.parameters)
    ) {
      rightText = `this.${instance}.get${toCamelCase(right.getName())}()`;
    }
    return `${leftText} ${expression
      .getOperatorToken()
      .getText()} ${rightText}`;
  }
}

function refactorOtherFiles(
  newClassInfo: NewClassInfo,
  project: Project,
  filePath: string,
  refactoreClass
) {
  const sourceFile = project.addSourceFileAtPath(filePath);
  sourceFile.forEachDescendant((node) => {
    if (node instanceof VariableDeclaration) {
      console.log(`Refactoring variable declaration: ${node.getText()}`);

      if (node.getInitializerIfKind(SyntaxKind.NewExpression)) {
        refactorNoArgInstance(newClassInfo, node, sourceFile);
        refactorWithArgInstance(newClassInfo, node, sourceFile, refactoreClass);
      }
    }
  });
  project.saveSync();
}

function refactorNoArgInstance(
  newClassInfo: NewClassInfo,
  node: VariableDeclaration,
  sourceFile: SourceFile
) {
  const instanceName = getInstanceName(newClassInfo);
  const initializer = node.getInitializerIfKind(SyntaxKind.NewExpression);
  if (
    initializer &&
    initializer.getExpression().getText() === newClassInfo.className
  ) {
    node.setInitializer(`new ${newClassInfo.className}()`);
    refactorVariableDeclaration(
      newClassInfo,
      node.getName(),
      instanceName,
      sourceFile
    );
  }
}

function refactorWithArgInstance(
  newClassInfo: NewClassInfo,
  node: VariableDeclaration,
  sourceFile: SourceFile,
  classToRefactor
) {
  const instanceName = getInstanceName(newClassInfo);
  const initializer = node.getInitializerIfKind(SyntaxKind.NewExpression);
  console.log("+++++++++++++++++++", initializer.getExpression().getText());
  console.log("--------------", classToRefactor.getName());
  if (
    initializer &&
    initializer.getExpression().getText() === classToRefactor.getName()
  ) {
    const argumentStr = initializer
      .getArguments()
      .map((arg) => arg.getText())
      .join(", ");
    node.setInitializer(
      `new ${classToRefactor.getName()}(new ${
        newClassInfo.className
      }(${argumentStr}))`
    );
    refactorVariableDeclaration(
      newClassInfo,
      node.getName(),
      classToRefactor.getName(),
      sourceFile
    );
  }
}

function refactorVariableDeclaration(
  newClassInfo: NewClassInfo,
  variableName: string,
  instanceName: string,
  sourceFile: SourceFile
) {
  console.log("-----------------------");

  sourceFile.forEachDescendant((descendantNode) => {
    if (descendantNode instanceof PropertyAccessExpression) {
      console.log("**************************");

      const accessedExpression = descendantNode.getExpression();
      if (
        accessedExpression.getText() === variableName &&
        parameterExists(descendantNode.getName(), newClassInfo.parameters)
      ) {
        accessedExpression.replaceWithText(`${variableName}.${instanceName}`);
        descendantNode.replaceWithText(
          `${instanceName}.get${toCamelCase(descendantNode.getName())}()`
        );
      }
    }
  });
}
