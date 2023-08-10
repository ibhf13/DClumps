import {
  ClassDeclaration,
  MethodDeclaration,
  Node,
  ParameterDeclaration,
  Project,
  ReferenceFindableNode,
  SyntaxKind,
} from "ts-morph";
import {
  ClassInfo,
  MethodInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyMethods,
  GlobalCalls,
} from "../utils/Interfaces";
import { doParametersMatch, projectFileList } from "../utils/DetectionsUtils";

let smellyMethodGroup: SmellyMethods[] = [];
let Data_Clumps_List: DataClumpsList[] = [];

function setSmellyMethodKeys(Data_Clumps_List: DataClumpsList[]) {
  Data_Clumps_List.forEach((dataClump, groupIndex) => {
    dataClump.smellyMethods?.forEach((smellyMethod, fieldIndex) => {
      smellyMethod.key = `${groupIndex}${fieldIndex + 1}`;
    });
  });
}

function addMetaInfo() {
  const metaInfo = {
    numberOfSmellyFieldGroups: Data_Clumps_List.length,
    totalNumberOfDataClumps: Data_Clumps_List.reduce(
      (total, clump) => total + (clump.smellyMethods?.length || 0),
      0
    ),
  };

  Data_Clumps_List.unshift({
    metaInfo,
  });
}

export function analyzeProjectFiles(
  codeAnalyzerProject: Project,
  toAnalyzeProjectFolder: string,
  minDataClumps: number,
  checkConstructor: boolean,
  excludeFolders: string[]
): DataClumpsList[] {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    // Analysis of classes
    let classesInFile = file.getClasses();
    classesInFile.forEach((cls) => {
      const methods = cls.getMethods();
      methods.forEach((method) => {
        // Skip if method is a constructor for speed
        if (!checkConstructor && method.getName() === "__constructor") return;

        compareMethodsWithOtherFiles(
          codeAnalyzerProject,
          method,
          toAnalyzeProjectFolder,
          minDataClumps,
          excludeFolders
        );

        //compareWithParentClassMethods(method, cls, file.getFilePath());
      });
    });

    if (smellyMethodGroup.length > 1) {
      Data_Clumps_List.push({
        smellyMethods: [...smellyMethodGroup],
      });
      smellyMethodGroup = [];
    }
  });

  addMetaInfo();
  setSmellyMethodKeys(Data_Clumps_List);

  console.log(
    `\nDetected ${Data_Clumps_List[0].metaInfo.totalNumberOfDataClumps} Smelly Fields\n`
  );
  return Data_Clumps_List;
}

function compareMethodsWithOtherFiles(
  codeAnalyzerProject: Project,
  method: MethodDeclaration,
  projectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
) {
  const projectFiles = projectFileList(projectFolder, excludeFolders);
  let matchFound = false;

  projectFiles.forEach((filePath) => {
    matchFound = compareWithOtherClasses(
      codeAnalyzerProject,
      method,
      filePath,
      matchFound,
      minDataClumps
    );
  });
}

function compareWithOtherClasses(
  codeAnalyzerProject: Project,
  method: MethodDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
) {
  const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
  const classesInFile = sourceFile.getClasses();

  classesInFile.forEach((otherClass) => {
    matchFound = findMatchingMethods(
      method,
      otherClass,
      filePath,
      matchFound,
      minDataClumps
    );
  });

  return matchFound;
}

function findMatchingMethods(
  method: MethodDeclaration,
  otherClass: ClassDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
) {
  const otherMethods = otherClass.getMethods();

  otherMethods.forEach((otherMethod) => {
    if (otherMethod !== method) {
      const otherMethodParameters = otherMethod.getParameters();

      if (otherMethodParameters.length > 2) {
        const methodParameters = method.getParameters();
        if (
          doParametersMatch(
            methodParameters,
            otherMethodParameters,
            minDataClumps
          )
        ) {
          matchFound = true;
          if (
            !isMethodInDataClumpsList(
              otherMethod.getName(),
              otherClass.getName()
            ) &&
            !isMethodInSmellymethodGroup(
              otherMethod.getName(),
              otherClass.getName()
            )
          ) {
            storeMethodInfo(otherMethod, otherClass, filePath);
          }
        }
      }
    }
  });

  return matchFound;
}

function isMethodInDataClumpsList(methodName: string, className: string) {
  return Data_Clumps_List.some((dataClump) =>
    dataClump.smellyMethods.some(
      (smellyMethod) =>
        smellyMethod.methodInfo.methodName === methodName &&
        smellyMethod.classInfo.className === className
    )
  );
}

function isMethodInSmellymethodGroup(methodName: string, className: string) {
  return smellyMethodGroup.some(
    (smellyMethod) =>
      smellyMethod.methodInfo.methodName === methodName &&
      smellyMethod.classInfo.className === className
  );
}

function storeMethodInfo(
  method: MethodDeclaration,
  clazz: ClassDeclaration,
  filepath: string
) {
  const parametersOfMethod = method.getParameters();

  // Don't store the method if it has no parameters
  if (parametersOfMethod.length === 0) {
    return;
  }

  const parameterInformation: ParameterInfo[] = parametersOfMethod.map(
    (param: ParameterDeclaration) => ({
      name: param.getName(),
      type: param.getType().getText(),
      value: param.getInitializer()?.getText(),
    })
  );

  const methodDetails: MethodInfo = {
    methodName: method.getName(),
    parameters: parameterInformation,
  };

  const classDetails: ClassInfo = {
    className: clazz.getName() || "",
    filepath,
  };

  const smellyMethod: SmellyMethods = {
    key: "0",
    methodInfo: methodDetails,
    classInfo: classDetails,
    callsInfo: {
      callsList: {
        callsInSame: 0,
        callsGlob: [],
      },
      callsCount: 0,
    },
  };

  analyzeMethodReferences(smellyMethod, method, clazz);

  smellyMethodGroup.push(smellyMethod);
}

function countCallsInSameClass(
  references: Node[],
  clazz: ClassDeclaration
): number {
  let callsInSameClass = 0;

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass) continue; // The reference might not be inside a class (it could be in a function or a variable, for example)

    const isSameClass = refClass.getName() === clazz.getName();
    if (isSameClass) callsInSameClass++;
  }

  return callsInSameClass;
}

function getGlobalCalls(
  references: Node[],
  clazz: ClassDeclaration
): GlobalCalls[] {
  let globalCalls: GlobalCalls[] = [];

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass || refClass.getName() === clazz.getName()) continue;

    let foundGlobalCall = globalCalls.find(
      (call) =>
        call.classInfo.className === refClass.getName() &&
        call.classInfo.filepath === refClass.getSourceFile().getFilePath()
    );

    if (foundGlobalCall) {
      foundGlobalCall.callsGlobCount++;
    } else {
      globalCalls.push({
        classInfo: {
          className: refClass.getName() || "",
          filepath: refClass.getSourceFile().getFilePath(),
        },
        callsGlobCount: 1,
      });
    }
  }

  return globalCalls;
}

function analyzeMethodReferences(
  smellyMethod: SmellyMethods,
  method: ReferenceFindableNode,
  clazz: ClassDeclaration
) {
  const references = method.findReferencesAsNodes();

  const callsInSameClass = countCallsInSameClass(references, clazz);
  const globalCalls = getGlobalCalls(references, clazz);

  smellyMethod.callsInfo.callsList = {
    callsInSame: callsInSameClass,
    callsGlob: globalCalls,
  };
  smellyMethod.callsInfo.callsCount = references.length;
}

// //----------------------------------------------------------
// //TODO handling interfaces
// function doesClassImplementItsInterfaces(clazz) {
//   const interfaces = clazz.getInterfaces();

//   for (let iface of interfaces) {
//     const interfaceMethods = iface.getMethods();

//     for (let interfaceMethod of interfaceMethods) {
//       const correspondingClassMethod = clazz.getMethod(
//         interfaceMethod.getName()
//       );

//       if (!correspondingClassMethod) {
//         console.error(
//           `Class ${clazz.getName()} does not implement method ${interfaceMethod.getName()} from interface ${iface.getName()}.`
//         );
//         return false;
//       }

//       const interfaceParameters = interfaceMethod.getParameters();
//       const classMethodParameters = correspondingClassMethod.getParameters();

//       if (interfaceParameters.length !== classMethodParameters.length) {
//         console.error(
//           `Method ${interfaceMethod.getName()} in class ${clazz.getName()} does not have the correct number of parameters for interface ${iface.getName()}.`
//         );
//         return false;
//       }

//       for (let i = 0; i < interfaceParameters.length; i++) {
//         if (
//           interfaceParameters[i].getType().getText() !==
//           classMethodParameters[i].getType().getText()
//         ) {
//           console.error(
//             `Parameter ${interfaceParameters[
//               i
//             ].getName()} in method ${interfaceMethod.getName()} of class ${clazz.getName()} does not have the correct type for interface ${iface.getName()}.`
//           );
//           return false;
//         }
//       }
//     }
//   }

//   return true;
// }
// //TODO handling inhiratence
// function compareWithParentClassMethods(
//   method: MethodDeclaration,
//   clazz: ClassDeclaration,
//   filePath: string,
//   minDataClumps: number
// ) {
//   let matchFound = false;

//   // Check if the class has a base class
//   if (clazz.getBaseClass()) {
//     const baseClass = clazz.getBaseClass();

//     const baseClassMethods = baseClass.getMethods();

//     baseClassMethods.forEach((baseMethod) => {
//       if (baseMethod.getName() !== method.getName()) {
//         return; // Skip method if names are different
//       }

//       const baseMethodParameters = baseMethod.getParameters();

//       if (baseMethodParameters.length > 2) {
//         const methodParameters = method.getParameters();
//         if (
//           doParametersMatch(
//             methodParameters,
//             baseMethodParameters,
//             minDataClumps
//           )
//         ) {
//           matchFound = true; // Set matchFound flag to true

//           if (
//             !isMethodInDataClumpsList(
//               baseMethod.getName(),
//               baseClass.getName()
//             ) &&
//             !isMethodInSmellymethodGroup(
//               baseMethod.getName(),
//               baseClass.getName()
//             )
//           ) {
//             storeMethodInfo(
//               baseMethod,
//               baseClass,
//               baseClass.getSourceFile().getFilePath()
//             );
//           }
//         }
//       }
//     });

//     // Store the original method if a match was found and it is not already in the smellyMethodGroup
//     if (
//       matchFound &&
//       !isMethodInDataClumpsList(method.getName(), clazz.getName())
//     ) {
//       storeMethodInfo(method, clazz, filePath);
//     }
//   }
// }

// function detectFieldDataClumpsInClass(
//   clazz: ClassDeclaration,
//   codeAnalyzerProject: Project,
//   projectFolder: string,
//   minDataClumps: number,
//   excludeFolders: string[]
// ) {
//   const classProperties = clazz.getProperties();
//   if (classProperties.length <= 1) {
//     // If the class has one or no properties, it can't have a data clump
//     return;
//   }

//   const projectFiles = projectFileList(projectFolder, excludeFolders);
//   projectFiles.forEach((filePath) => {
//     const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
//     const classesInFile = sourceFile.getClasses();
//     classesInFile.forEach((otherClass) => {
//       if (otherClass === clazz) return;
//       const otherClassProperties = otherClass.getProperties();

//       if (otherClassProperties.length > 1) {
//         const fieldsMatch = doFieldsMatch(
//           classProperties,
//           otherClassProperties,
//           minDataClumps
//         );

//         if (fieldsMatch) {
//           storeClassInfo(clazz, classProperties);
//           storeClassInfo(otherClass, otherClassProperties);
//         }
//       }
//     });
//   });
// }

// function doFieldsMatch(
//   fields1: PropertyDeclaration[],
//   fields2: PropertyDeclaration[],
//   minDataClumps: number
// ) {
//   let matchMap = new Map();

//   for (let field1 of fields1) {
//     for (let field2 of fields2) {
//       if (
//         field1.getName() === field2.getName() &&
//         field1.getType().getText() === field2.getType().getText()
//       ) {
//         let matchKey = field1.getName() + field1.getType().getText();
//         matchMap.set(matchKey, (matchMap.get(matchKey) || 0) + 1);
//       }
//     }
//   }

//   let matchCount = 0;
//   for (let count of matchMap.values()) {
//     matchCount += count;
//     if (matchCount >= minDataClumps) return true;
//   }

//   return false;
// }

// function storeClassInfo(
//   clazz: ClassDeclaration,
//   fields: PropertyDeclaration[]
// ) {
//   const fieldInformation: ParameterInfo[] = fields.map(
//     (field: PropertyDeclaration) => ({
//       name: field.getName(),
//       type: field.getType().getText(),
//       value: field.getInitializer()?.getText(),
//     })
//   );

//   const classDetails: NewClassInfo = {
//     className: clazz.getName() || "",
//     filepath: clazz.getSourceFile().getFilePath(),
//     parameters: fieldInformation,
//   };

//   Data_Clumps_List.push({
//     classInfo: classDetails,
//   });
// }
