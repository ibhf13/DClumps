import { Project } from "ts-morph";
import { analyzeProjectFiles } from "./DetectorSmellyMethods";
import {
  createNewClassesFromDataClumpsList,
  createNewClassesUsingKey,
} from "./NewClassSmellyMethods";
import { writeFileSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import {
  ClassInfo,
  DataClumpsList,
  MethodInfo,
  SmellyMethods,
} from "../utils/Interfaces";
import { DetectSmellyFields } from "./DetectorSmellyFields";
import { createNewClassesFromSmellyFieldDataClumpsList } from "./NewClassSmellyFields";
import * as readline from "readline";
import { log } from "console";
import {
  filterBySmellyKeys,
  filterSmellyMethods,
  removeMetaInfo,
} from "../utils/newClassUtils";

function getDataClumpsList(filePath: string): DataClumpsList[] {
  try {
    const fileContents = fs.readFileSync(path.resolve(filePath), "utf-8");
    const data = JSON.parse(fileContents);

    return data.map((item: any) => {
      const smellyMethods = item.smellyMethods.map((smellyMethod: any) => {
        const { methodInfo, classInfo, callsList, callsCount } = smellyMethod;

        const mappedMethodInfo: MethodInfo = {
          methodName: methodInfo.methodName,
          parameters: methodInfo.parameters.map((parameter: any) => ({
            name: parameter.name,
            type: parameter.type,
            value: parameter.value,
          })),
        };

        const mappedClassInfo: ClassInfo = {
          className: classInfo.className,
          filepath: classInfo.filepath,
        };

        const mappedCallsList = {
          callsInSame: callsList.callsInSame,
          callsGlob: callsList.callsGlob.map((call: any) => ({
            classInfo: {
              className: call.classInfo.className,
              filepath: call.classInfo.filepath,
            },
            callsGlobCount: call.callsGlobCount,
          })),
        };

        return {
          methodInfo: mappedMethodInfo,
          classInfo: mappedClassInfo,
          callsList: mappedCallsList,
          callsCount,
        };
      });
      return { smellyMethods };
    });
  } catch (error) {
    console.error("Error reading and parsing file", error);
    return [];
  }
}
function readlineAsync(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
async function askAnchorDataClump(
  dataClumpsList: DataClumpsList[]
): Promise<string> {
  while (true) {
    const answer = await readlineAsync("What is the anchor data clump? ");
    if (
      isValidPositiveNumber(answer) &&
      keyExistsInSmellyMethods(dataClumpsList, answer)
    ) {
      return answer;
    }
    console.log("Invalid input. Please enter a valid key from smellyMethods.");
  }
}

async function askDataClumpsToRefactor(
  dataClumpsList: DataClumpsList[]
): Promise<string[]> {
  let validAnswers: string[] = [];

  while (true) {
    const answer = await readlineAsync(
      "Type 'end' to stop \nWhat Data clumps do you want to refactor? "
    );
    if (answer.toLowerCase() === "end") {
      break;
    }
    if (
      isValidPositiveNumber(answer) &&
      keyExistsInSmellyMethods(dataClumpsList, answer)
    ) {
      if (validAnswers.includes(answer)) {
        console.log(
          `'${answer}' has already been added. Enter another value or type 'end' to stop.`
        );
        continue;
      }
      validAnswers.push(answer);
    } else {
      console.log(
        `Invalid input for '${answer}'. Please enter a valid key from smellyMethods.`
      );
    }
  }
  return validAnswers;
}

function isValidPositiveNumber(num: string): boolean {
  const n = parseInt(num, 10);
  return n > 0 && Number.isInteger(n);
}

function keyExistsInSmellyMethods(
  dataClumpsList: DataClumpsList[],
  key: string
): boolean {
  return dataClumpsList.some((dataClumps) =>
    dataClumps.smellyMethods.some((smellyMethod) => smellyMethod.key === key)
  );
}

function keysInSameGroup(
  dataClumpsList: DataClumpsList[],
  anchor: string,
  refactoredKeyList: string[]
): boolean {
  return dataClumpsList.some((dataClumps) => {
    const keysInCurrentClump = new Set(
      dataClumps.smellyMethods.map((method) => method.key)
    );
    return (
      keysInCurrentClump.has(anchor) &&
      refactoredKeyList.every((k) => keysInCurrentClump.has(k))
    );
  });
}

function summarizeKeys(
  refactoredKeys: string[],
  anchorDataClump: string
): string[] {
  if (refactoredKeys.includes(anchorDataClump)) {
    refactoredKeys.splice(refactoredKeys.indexOf(anchorDataClump), 1);
  }
  refactoredKeys.unshift(anchorDataClump);

  return refactoredKeys;
}

async function wantsOptimumSolution(): Promise<boolean> {
  while (true) {
    const answer = await readlineAsync(
      "Do you want the optimum solution? (y/n): "
    );
    if (answer.toLowerCase() === "y") {
      return true;
    } else if (answer.toLowerCase() === "n") {
      return false;
    }
    console.log("Invalid input. Please answer with 'y' or 'n'.");
  }
}

async function main() {
  //initialize the date collection variables
  let codeAnalyzerProject = new Project();
  let codeAnalyzerProject2 = new Project();

  const MIN_MATCHES = 3;
  const toAnalyzeProjectFolder: string = "./src/**/*.ts";
  const outputPath = "./src/output/extractedClasses/";
  let excludedFolders = ["node_modules"];
  const withConstructor = true;
  console.log(
    `start analyzing  ${toAnalyzeProjectFolder} for dataclumps \n...`
  );
  // if we want just to use existing dataclumps from json file
  //const dataclumpsFilepath = "./src/output/jsonDclumps/Data_Clumps_List.json";
  //const DataClumpsListFromFile = getDataClumpsList(dataclumpsFilepath);

  // Analyze the project files for data clumps
  codeAnalyzerProject.addSourceFilesAtPaths(toAnalyzeProjectFolder);
  let dataClumpsList = analyzeProjectFiles(
    codeAnalyzerProject,
    toAnalyzeProjectFolder,
    MIN_MATCHES,
    withConstructor,
    excludedFolders
  );

  writeFileSync(
    "./src/output/jsonDclumps/Data_Clumps_List.json",
    JSON.stringify(dataClumpsList, null, 2)
  );
  console.log(
    `found ${dataClumpsList[0].metaInfo.numberOfSmellyFieldGroups} Data Clumps Groups`
  );

  console.log("\n\n\nStart refactoring \n...");
  console.log("Create new Classes for Smelly Methods");

  const dataClumps = removeMetaInfo(dataClumpsList);

  const anchorDataClump = await askAnchorDataClump(dataClumps);

  const refactoredKeys = await askDataClumpsToRefactor(dataClumps);

  const allInSameGroup = keysInSameGroup(
    dataClumps,
    anchorDataClump,
    refactoredKeys
  );

  if (allInSameGroup) {
    const allKeys = summarizeKeys(refactoredKeys, anchorDataClump);
    if (wantsOptimumSolution()) {
      const userChoiceGroup = filterSmellyMethods(dataClumps, allKeys);
      createNewClassesFromDataClumpsList(userChoiceGroup, outputPath);
    }
    createNewClassesUsingKey(dataClumps, outputPath, allKeys);
  } else {
    console.log("The keys are not in the same group");
  }
  //createNewClassesFromDataClumpsList(dataClumps, outputPath);

  //-------------------------------------------------------------------------

  // codeAnalyzerProject2.addSourceFilesAtPaths(toAnalyzeProjectFolder);

  // let dataClumpsListWithFields = DetectSmellyFields(
  //   codeAnalyzerProject2,
  //   toAnalyzeProjectFolder,
  //   MIN_MATCHES,
  //   excludedFolders
  // );

  // console.log(
  //   `found ${dataClumpsListWithFields[0].metaInfo.numberOfSmellyFieldGroups} Data Clumps Groups`
  // );

  // writeFileSync(
  //   "./src/output/jsonDclumps/Data_Clumps_List_With_Fields.json",
  //   JSON.stringify(dataClumpsListWithFields, null, 2)
  // );
  // console.log("Create new Classes for Smelly Fields");

  // createNewClassesFromSmellyFieldDataClumpsList(
  //   dataClumpsListWithFields,
  //   outputPath
  // );
}

// Run the main function
main();
