import {
  ClassDeclaration,
  MethodDeclaration,
  Project,
  Scope,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import {
  DataClumpsList,
  SmellyMethods,
  ParameterInfo,
  NewClassInfo,
  MethodInfo,
} from "../utils/Interfaces";
import { existsSync } from "fs";
const project = new Project();
const outputPath = "./src/output/extractedClasses/";

function generateUniqueFileName(baseName: string): string {
  let counter = 0;
  let fileName = `${baseName}.ts`;

  while (existsSync(`${outputPath}${fileName}`)) {
    counter++;
    fileName = `${baseName}${counter}.ts`;
  }

  return fileName;
}

function exportNewFileData(
  newClassDeclaration: ClassDeclaration,
  fileName: string
) {
  const filePath = outputPath + fileName;

  const project = new Project();
  const sourceFile: SourceFile = project.createSourceFile(filePath);
  sourceFile.addClass(newClassDeclaration.getStructure());

  project.saveSync();

  return { className: newClassDeclaration.getName(), filepath: filePath };
}

function getMethodWithLeastParameters(
  dataClumpsList: DataClumpsList
): SmellyMethods {
  // Assuming dataClumpsList.smellyMethods is not undefined
  return dataClumpsList.smellyMethods!.reduce((leastMethod, currentMethod) => {
    return currentMethod.methodInfo.parameters.length <
      leastMethod.methodInfo.parameters.length
      ? currentMethod
      : leastMethod;
  });
}

function createNewClass(
  fileName: string,
  newClassName: string
): ClassDeclaration {
  const srcFile = project.createSourceFile(
    `src/output/extractedClasses/${fileName}`,
    "",
    { overwrite: true }
  );

  const newClass = srcFile.addClass({
    name: newClassName,
    isExported: true,
  });

  return newClass;
}

function defineClassVariables(
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  smellyMethod.methodInfo.parameters.forEach((parameter: ParameterInfo) => {
    newClassDeclaration.addProperty({
      name: parameter.name,
      type: parameter.type,
      scope: Scope.Private,
    });
  });
}

function implementConstructor(
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  const constructorDeclaration = newClassDeclaration.addConstructor();

  smellyMethod.methodInfo.parameters.forEach(
    (parameter: ParameterInfo, index: number) => {
      constructorDeclaration.addParameter({
        name: parameter.name,
        type: parameter.type,
      });

      if (index === 0) {
        constructorDeclaration.setBodyText((writer) =>
          writer.write(`this.${parameter.name} = ${parameter.name};`)
        );
      } else {
        constructorDeclaration.addStatements((writer) =>
          writer.write(`this.${parameter.name} = ${parameter.name};`)
        );
      }
    }
  );
}

function createGettersAndSetters(
  smellyMethod: SmellyMethods,
  newClassDeclaration: ClassDeclaration
) {
  smellyMethod.methodInfo.parameters.forEach((parameter: ParameterInfo) => {
    newClassDeclaration.addGetAccessor({
      name:
        "get" +
        parameter.name.charAt(0).toUpperCase() +
        parameter.name.slice(1),
      returnType: parameter.type,
      statements: `return this.${parameter.name};`,
    });

    newClassDeclaration.addSetAccessor({
      name:
        "set" +
        parameter.name.charAt(0).toUpperCase() +
        parameter.name.slice(1),
      parameters: [{ name: parameter.name, type: parameter.type }],
      statements: `this.${parameter.name} = ${parameter.name};`,
    });
  });
}

export function createNewClassesFromDataClumpsList(
  dataClumpsList: DataClumpsList[]
) {
  dataClumpsList.forEach((dataClump) => {
    const leastParameterMethod = getMethodWithLeastParameters(dataClump);

    // Generate newClassName by joining parameter names
    let newClassName = leastParameterMethod.methodInfo.parameters
      .map(
        (parameter) =>
          parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
      )
      .join("");

    // If no parameters, fallback to the class name
    if (newClassName === "") {
      newClassName = leastParameterMethod.classInfo.className;
    }

    // File name should be based on the class name
    const fileName = generateUniqueFileName(
      leastParameterMethod.classInfo.className
    );

    const newClassDeclaration = createNewClass(fileName, newClassName);

    defineClassVariables(leastParameterMethod, newClassDeclaration);

    implementConstructor(leastParameterMethod, newClassDeclaration);

    createGettersAndSetters(leastParameterMethod, newClassDeclaration);

    const newClassInfo = exportNewFileData(newClassDeclaration, fileName);
    refactorSmellyMethod(leastParameterMethod, newClassInfo);

    console.log(
      `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
    );
  });

  project.saveSync();
}

function parseFileToAst(filepath: string): SourceFile {
  return project.addSourceFileAtPath(filepath);
}

function importNewClass(file: SourceFile, newClassInfo: NewClassInfo) {
  file.addImportDeclaration({
    moduleSpecifier: newClassInfo.filepath.replace(".ts", ""),
    namedImports: [newClassInfo.className],
  });
}

function findMethodInAst(
  file: SourceFile,
  methodInfo: MethodInfo
): MethodDeclaration | undefined {
  const classes = file.getClasses();
  let methodDeclaration: MethodDeclaration | undefined;

  classes.some((cls) => {
    methodDeclaration = cls.getMethod(methodInfo.methodName);
    return methodDeclaration !== undefined;
  });

  return methodDeclaration;
}

function replaceParameters(
  method: MethodDeclaration,
  newClassInfo: NewClassInfo,
  smellyMethod: SmellyMethods
) {
  if (
    method.getParameters().length === smellyMethod.methodInfo.parameters.length
  ) {
    method.getParameters().forEach((param) => param.remove());
    method.addParameter({
      name: "newParam",
      type: newClassInfo.className,
    });
  } else {
    method.getParameters().forEach((param) => {
      smellyMethod.methodInfo.parameters.forEach((smellyParam) => {
        if (param.getName() === smellyParam.name) {
          param.remove();
          method.addParameter({
            name: smellyParam.name,
            type: newClassInfo.className,
          });
        }
      });
    });
  }
}

function updateReferences(
  method: MethodDeclaration,
  smellyMethod: SmellyMethods
) {
  let methodBody = method.getBodyText();
  smellyMethod.methodInfo.parameters.forEach((parameter) => {
    const getterName = `get${
      parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    }`;
    const setterName = `set${
      parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1)
    }`;

    // Regular expression to find assignments to this parameter
    const assignmentRegex = new RegExp(
      `(\\b${parameter.name}\\s*=\\s*)([^;]+)`,
      "g"
    );
    methodBody = methodBody.replace(
      assignmentRegex,
      `newParam.${setterName}($2)`
    );

    // Replace direct usage of the parameter with getter
    const usageRegex = new RegExp(`\\b${parameter.name}\\b`, "g");
    methodBody = methodBody.replace(usageRegex, `newParam.${getterName}()`);
  });

  method.setBodyText(methodBody);
}

// function findAndReplaceMethodCalls(
//   file: SourceFile,
//   smellyMethod: SmellyMethods,
//   newClassInfo: NewClassInfo
// ) {
//   const callExpressions = file.getDescendantsOfKind(SyntaxKind.CallExpression);

//   callExpressions.forEach((call) => {
//     if (call.getExpression().getText() === smellyMethod.methodInfo.methodName) {
//       call.getArguments().forEach((arg) => {
//         smellyMethod.methodInfo.parameters.forEach((smellyParam) => {
//           if (arg.getText() === smellyParam.name) {
//             arg.replaceWithText(
//               `new ${
//                 newClassInfo.className
//               }(${smellyMethod.methodInfo.parameters
//                 .map((param) => param.name)
//                 .join(", ")})`
//             );
//           }
//         });
//       });
//     }
//   });
// }

export function refactorSmellyMethod(
  smellyMethod: SmellyMethods,
  newClassInfo: NewClassInfo
) {
  const file = parseFileToAst(smellyMethod.classInfo.filepath);
  importNewClass(file, newClassInfo);

  const method = findMethodInAst(file, smellyMethod.methodInfo);
  if (method) {
    replaceParameters(method, newClassInfo, smellyMethod);
    updateReferences(method, smellyMethod);
    // findAndReplaceMethodCalls(file, smellyMethod, newClassInfo);
  }

  file.saveSync();
}
