import {
  BinaryExpression,
  Block,
  ClassDeclaration,
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
  SmellyFields,
  SmellyMethods,
} from "../utils/Interfaces";

export function refactorSmellyFields(
  newClassInfo: NewClassInfo,
  leastParameterField: SmellyFields,
  smellyFieldGroup: DataClumpsList,
  project: Project
) {
  refactorSelectedField(newClassInfo, leastParameterField, project);
  const fieldGroupCopy = removeSelectedField(
    leastParameterField,
    smellyFieldGroup
  );

  for (const field of fieldGroupCopy) {
    refactorSelectedField(newClassInfo, field, project);
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

function refactorSelectedField(
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

  const sharedParameters = updateFieldsInClass(newClassInfo, classToRefactor);

  updateClassBody(newClassInfo, classToRefactor, sharedParameters);

  project.saveSync();
}

function updateFieldsInClass(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration
): string[] {
  const sharedParameters: string[] = [];
  classToRefactor.getProperties().forEach((property) => {
    const propertyName = property.getName();
    const newPropertyExists = parameterExists(
      propertyName,
      newClassInfo.parameters
    );

    if (newPropertyExists) {
      sharedParameters.push(propertyName);
      property.remove();
    }
  });

  const instanceName = toCamelCase(newClassInfo.className) + "Instance";
  classToRefactor.insertProperty(0, {
    name: instanceName,
    type: newClassInfo.className,
  });

  return sharedParameters;
}

function updateClassBody(
  newClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration,
  sharedParameters: string[]
) {
  const instanceName = toCamelCase(newClassInfo.className) + "Instance";

  // Identify uncommon properties
  const propertyNames = classToRefactor
    .getProperties()
    .map((prop) => prop.getName());
  const uncommonProperties = propertyNames.filter(
    (prop) => !sharedParameters.includes(prop) && prop !== instanceName
  );

  // Check if constructor exists, if not create one
  let constructor = classToRefactor.getConstructors()[0];
  if (!constructor) {
    constructor = classToRefactor.addConstructor();
    constructor.setOrder(1);
  }

  // Define new constructor parameter
  const constructorParams = [
    {
      name: instanceName,
      type: newClassInfo.className,
    },
  ];

  // Add uncommon properties to constructor parameters
  uncommonProperties.forEach((prop) => {
    constructorParams.push({
      name: prop,
      type:
        classToRefactor.getProperty(prop)?.getTypeNode()?.getText() || "any",
    });
  });

  // Remove old constructor parameters
  constructor.getParameters().forEach((param) => param.remove());

  // Add new parameters to the constructor
  constructorParams.forEach(({ name, type }) => {
    constructor.addParameter({
      name,
      type,
    });
  });

  // Add new constructor statements
  constructor.addStatements(`this.${instanceName} = ${instanceName};`);
  uncommonProperties.forEach((prop) => {
    constructor.addStatements(`this.${prop} = ${prop};`);
  });

  // Update references in methods
  classToRefactor.getMethods().forEach((method) => {
    updateFieldsWithGetter(newClassInfo, method);
  });

  // Add new property
  const existingProp = classToRefactor.getProperty(instanceName);
  if (!existingProp) {
    classToRefactor.insertProperty(0, {
      name: instanceName,
      type: newClassInfo.className,
    });
  }

  // Format the refactored class
  classToRefactor.formatText();
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

  console.log(`Processing expression: ${leftText} = ${rightText}`);

  if (right instanceof BinaryExpression) {
    rightText = processExpression(right, instance, newClassInfo);
  }

  const assignment =
    expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
  if (assignment) {
    if (parameterExists(leftText, newClassInfo.parameters)) {
      return `${instance}.set${toCamelCase(leftText)}(${rightText})`;
    }
    if (parameterExists(rightText, newClassInfo.parameters)) {
      rightText = `${instance}.get${toCamelCase(rightText)}()`;
    }
    return `${leftText} = ${rightText}`;
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

function updateFieldsWithGetter(newClassInfo, method) {
  const instance = getInstanceName(newClassInfo);

  method
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .forEach((propertyAccessExpression) => {
      const identifier = propertyAccessExpression.getNameNode();
      const paramName = identifier.getText();

      console.log(`Checking identifier: ${paramName}`);

      if (identifier.getParent() instanceof BinaryExpression) {
        const newIdentifierText = processExpression(
          identifier.getParent(),
          instance,
          newClassInfo
        );

        console.log(
          `Replacing ${propertyAccessExpression.getText()} with ${newIdentifierText}`
        );
        propertyAccessExpression.replaceWithText(newIdentifierText);
      } else if (parameterExists(paramName, newClassInfo.parameters)) {
        const newIdentifierText = `${instance}.get${toCamelCase(paramName)}()`;

        console.log(
          `Replacing ${propertyAccessExpression.getText()} with ${newIdentifierText}`
        );
        propertyAccessExpression.replaceWithText(newIdentifierText);
      }
    });
}

function toCamelCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
