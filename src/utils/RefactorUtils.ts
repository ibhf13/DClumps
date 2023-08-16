import { ClassDeclaration, SourceFile, Node } from "ts-morph";
import { NewClassInfo, ParameterInfo } from "./Interfaces";
import * as path from "path";

export function toCamelCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function getInstanceName(extractedClassInfo: NewClassInfo) {
  const instance = `${extractedClassInfo.className
    .charAt(0)
    .toLowerCase()}${extractedClassInfo.className.slice(1)}Instance`;
  return instance;
}

export function parameterExists(
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

export function importNewClass(
  file: SourceFile,
  extractedClassInfo: NewClassInfo
) {
  const filePath = file.getFilePath();
  const correctPath = determineImportPath(
    filePath,
    extractedClassInfo.filepath
  );

  const existingImport = file.getImportDeclaration(
    (declaration) =>
      declaration.getModuleSpecifierValue() === correctPath &&
      declaration
        .getNamedImports()
        .some(
          (namedImport) =>
            namedImport.getName() === extractedClassInfo.className
        )
  );

  if (!existingImport) {
    file.addImportDeclaration({
      moduleSpecifier: correctPath,
      namedImports: [extractedClassInfo.className],
    });
  }
}

export function getSharedFields(
  extractedClassInfo: NewClassInfo,
  classToRefactor: ClassDeclaration
): string[] {
  const sharedFields: string[] = [];

  const currentClassFields = new Map(
    classToRefactor
      .getProperties()
      .map((property) => [
        property.getName(),
        property.getInitializer()?.getText() || "undefined",
      ])
  );

  extractedClassInfo.parameters.forEach((param) => {
    if (currentClassFields.has(param.name)) {
      sharedFields.push(param.name);
    }
  });
  return sharedFields;
}

export function removeSharedProperties(
  classToRefactor: ClassDeclaration,
  sharedParameters: string[]
) {
  sharedParameters.forEach((param) => {
    const property = classToRefactor.getProperty(param);
    property?.remove();
  });
}

export function getArgumentType(arg: Node) {
  return (
    arg.getType().getApparentType().getText().charAt(0).toLowerCase() +
    arg.getType().getApparentType().getText().slice(1)
  );
}
