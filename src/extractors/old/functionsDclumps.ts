import {
  FunctionDeclaration,
  ParameterDeclaration,
  Project,
  SyntaxKind,
} from "ts-morph";
import {
  ParameterInfo,
  DataClumpsList,
  SmellyFunction,
  FunctionGlobalCalls,
  FunctionInfo,
} from "../utils/Interfaces";
import { writeFileSync } from "fs";

let codeAnalyzerProject = new Project();
let smellyFunctionGroup: SmellyFunction[] = [];
let Data_Clumps_List: DataClumpsList[] = [];
const MIN_MATCHES = 3;

const projectDirectory = "./src";
codeAnalyzerProject.addSourceFilesAtPaths(`${projectDirectory}/**/*.ts`);

function projectFileList(): string[] {
  let project = new Project();
  project.addSourceFilesAtPaths("./src/**/*.ts");

  return project.getSourceFiles().map((file) => file.getFilePath());
}

function analyzeProjectFiles() {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    // Analysis of standalone functions
    const functionsInFile = file.getFunctions();

    functionsInFile.forEach((func) => {
      compareWithFunctionsInSameOrOtherFiles(func, file.getFilePath());
    });

    if (smellyFunctionGroup.length > 1) {
      console.log(
        `Detected ${
          smellyFunctionGroup.length
        } smelly standalone functions in file: ${file.getFilePath()}`
      );
      Data_Clumps_List.push({
        smellyFunctions: [...smellyFunctionGroup],
      });
      smellyFunctionGroup = [];
    }
  });
}

function compareWithFunctionsInSameOrOtherFiles(func, filepath) {
  const projectFiles = projectFileList();
  let matchFound = false;

  projectFiles.forEach((filePath) => {
    const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
    const functionsInFile = sourceFile.getFunctions();

    functionsInFile.forEach((otherFunc) => {
      if (otherFunc !== func) {
        const otherFuncParameters = otherFunc.getParameters();

        if (otherFuncParameters.length > 2) {
          const funcParameters = func.getParameters();
          if (doParametersMatch(funcParameters, otherFuncParameters)) {
            matchFound = true; // Set matchFound flag to true
            if (
              !isFuncInDataClumpsList(otherFunc.getName()) &&
              !isFuncInSmellyFunctionGroup(otherFunc.getName())
            ) {
              storeFunctionInfo(otherFunc, filePath);
            }
          }
        }
      }
    });
  });

  // Store the original function if a match was found and it is not already in the smellyFunctionGroup
  if (
    matchFound && // Check if a match was found
    !isFuncInDataClumpsList(func.getName()) &&
    !isFuncInSmellyFunctionGroup(func.getName())
  ) {
    storeFunctionInfo(func, filepath);
  }
}

function storeFunctionInfo(func, filepath) {
  const parametersOfFunction = func.getParameters();

  // Don't store the function if it has no parameters
  if (parametersOfFunction.length === 0) {
    return;
  }

  const parameterInformation: ParameterInfo[] = parametersOfFunction.map(
    (param: ParameterDeclaration) => ({
      name: param.getName(),
      type: param.getType().getText(),
      value: param.getInitializer()?.getText(),
    })
  );

  const functionDetails: FunctionInfo = {
    functionFilePath: filepath,
    functionName: func.getName(),
    parameters: parameterInformation,
  };

  const smellyFunction: SmellyFunction = {
    functionInfo: functionDetails,
    callsList: {
      callsInSame: 0,
      callsGlob: [],
    },
    callsCount: 0,
  };

  analyzeFunctionReferences(smellyFunction, func);

  smellyFunctionGroup.push(smellyFunction);
}

function analyzeFunctionReferences(
  smellyFunction: SmellyFunction,
  func: FunctionDeclaration
) {
  let callsInSameFile = 0;
  let globalCalls: FunctionGlobalCalls[] = [];

  const references = func.findReferencesAsNodes();

  references.forEach((ref) => {
    const isSameFile =
      ref.getSourceFile().getFilePath() === func.getSourceFile().getFilePath();

    if (isSameFile) {
      // Check if the reference is a call expression
      if (ref.getParentIfKind(SyntaxKind.CallExpression)) {
        callsInSameFile++;
      }
    } else {
      // Check if the reference is a call expression
      if (ref.getParentIfKind(SyntaxKind.CallExpression)) {
        const filePath = ref.getSourceFile().getFilePath();
        let foundGlobalCall = globalCalls.find(
          (call) => call.filePath === filePath
        );

        if (foundGlobalCall) {
          foundGlobalCall.callsGlobCount++;
        } else {
          globalCalls.push({
            filePath: filePath,
            callsGlobCount: 1,
          });
        }
      }
    }
  });

  // Subtract 1 from callsInSameFile to remove the function declaration reference
  smellyFunction.callsList = {
    callsInSame: callsInSameFile,
    callsGlob: globalCalls,
  };
  smellyFunction.callsCount = callsInSameFile;
}

function isFuncInDataClumpsList(funcName: string) {
  for (let file of Data_Clumps_List) {
    for (let smellyFunction of file.smellyFunctions) {
      if (smellyFunction.functionInfo.functionName === funcName) {
        return true;
      }
    }
  }
  return false;
}

function isFuncInSmellyFunctionGroup(funcName: string) {
  for (let smellyFunction of smellyFunctionGroup) {
    if (smellyFunction.functionInfo.functionName === funcName) {
      return true;
    }
  }
  return false;
}

function doParametersMatch(params1, params2) {
  let matchMap = new Map();

  for (let param1 of params1) {
    for (let param2 of params2) {
      if (
        param1.getName() === param2.getName() &&
        param1.getType().getText() === param2.getType().getText()
      ) {
        let matchKey = param1.getName() + param1.getType().getText();
        matchMap.set(matchKey, (matchMap.get(matchKey) || 0) + 1);
      }
    }
  }

  let matchCount = 0;
  for (let count of matchMap.values()) {
    matchCount += count;
    if (matchCount >= MIN_MATCHES) return true;
  }

  return false;
}

analyzeProjectFiles();

console.log(`found ${Data_Clumps_List.length} Dataclumps`);

writeFileSync(
  "./Data_Clumps_Functions_List.json",
  JSON.stringify(Data_Clumps_List, null, 2)
);
