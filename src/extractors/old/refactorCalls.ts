import { Project, SyntaxKind } from "ts-morph";
import {
  SmellyMethods,
  NewClassInfo,
  ParameterInfo,
  ClassInfo,
} from "../utils/Interfaces"; // replace 'yourInterfacesFile' with the correct file

export function updateMethodReferences(
  smellyMethod: SmellyMethods,
  newClassInfo: NewClassInfo,
  project: Project
) {
  const sourceFile = project.addSourceFileAtPath(
    smellyMethod.classInfo.filepath
  );
  const clazz = sourceFile.getClass(smellyMethod.classInfo.className);

  if (!clazz) {
    throw new Error(
      `Class ${smellyMethod.classInfo.className} not found in ${smellyMethod.classInfo.filepath}`
    );
  }

  const method = clazz.getMethod(smellyMethod.methodInfo.methodName);

  if (!method) {
    throw new Error(
      `Method ${smellyMethod.methodInfo.methodName} not found in class ${smellyMethod.classInfo.className}`
    );
  }

  const references = method.findReferencesAsNodes();

  references.forEach((ref) => {
    const callExpression = ref.getFirstAncestorByKind(
      SyntaxKind.CallExpression
    );
    console.log(
      "--------------------------------\n",
      `Method ${smellyMethod.methodInfo.methodName} found in class ${
        smellyMethod.classInfo.className
      }\n in file ${callExpression.getSourceFile().getFilePath()}\n `,
      "--------------------------------\n"
    );
    // Assuming the arguments are named the same as the new class parameters
    const instanceParamsNames = newClassInfo.parameters.map(
      (param) => param.type
    );
    let matchingArgs = [];
    let remainingArgs = [];

    console.log("instance parameter :", instanceParamsNames);
    console.log("callText", callExpression.getText());

    if (
      smellyMethod.classInfo.filepath ===
      callExpression.getSourceFile().getFilePath()
    ) {
      callExpression.getArguments().forEach((arg, i) => {
        if (instanceParamsNames[i] == arg.getType().getText()) {
          console.log("++++++++++++++++++++++++++++++++++\n", arg.getText());
          matchingArgs.push(arg);
        } else {
          remainingArgs.push(arg);
        }
      });

      // Arguments match the new class, so replace with a new instance
      const newClassInstance = `this.${method.getText()}(${
        newClassInfo.className
      }(${matchingArgs.join(", ")})`;
      const newArguments = [newClassInstance, ...remainingArgs].join(", ");
      callExpression.replaceWithText(newArguments);
    }
  });

  project.saveSync();
}
