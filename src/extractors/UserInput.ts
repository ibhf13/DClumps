import {
  createNewClassesFromKeyList,
  createNewClassesUsingAnchorKeyForSmellyMethods,
} from "./NewClassSmellyMethods";
import {
  DataClumpsList,
  DataClumpsType,
  SmellyFields,
  SmellyMethods,
} from "../utils/Interfaces";
import * as readline from "readline";
import { filterDataClumpsList, removeMetaInfo } from "../utils/newClassUtils";
import {
  createNewClassesFromKeyListForSmellyFields,
  createNewClassesUsingAnchorKeyForSmellyFields,
} from "./NewClassSmellyFields";

async function readlineAsync(prompt: string): Promise<string> {
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
      keyExistsInDataClumpsList(dataClumpsList, answer, "smellyFields")
    ) {
      return answer;
    }
    console.log();
    console.log(
      `Invalid input for '${answer}'. Please enter a valid key from Data Clumps list.`
    );
  }
}

async function askDataClumpsToRefactor(
  dataClumpsList: DataClumpsList[],
  anchorDataClump: string,
  type: "smellyMethods" | "smellyFields"
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
      keyExistsInDataClumpsList(dataClumpsList, answer, type) &&
      keysInSameGroup(dataClumpsList, anchorDataClump, [answer], type)
    ) {
      if (validAnswers.includes(answer)) {
        console.log();
        console.log(
          `'${answer}' has already been added. Enter another value or type 'end' to stop.`
        );
        continue;
      }
      validAnswers.push(answer);
    } else {
      console.log();
      console.log(
        `Invalid input for '${answer}' or not in the same Group. 
        \nPlease enter a valid key from Data Clumps List and make sure it belong to the same group.\n`
      );
    }
  }
  return validAnswers;
}

function isValidPositiveNumber(num: string): boolean {
  const n = parseInt(num, 10);
  return n > 0 && Number.isInteger(n);
}

function keyExistsInDataClumpsList(
  dataClumpsList: DataClumpsList[],
  key: string,
  type: "smellyMethods" | "smellyFields"
): boolean {
  if (type === "smellyMethods") {
    return dataClumpsList.some((dataClumps) =>
      dataClumps.smellyMethods.some((smellyMethod) => smellyMethod.key === key)
    );
  } else if (type === "smellyFields") {
    return dataClumpsList.some((dataClumps) =>
      dataClumps.smellyFields.some((smellyField) => smellyField.key === key)
    );
  }
}

function keysInSameGroup(
  dataClumpsList: DataClumpsList[],
  anchor: string,
  refactoredKeyList: string[],
  type: "smellyMethods" | "smellyFields"
): boolean {
  if (type === "smellyMethods") {
    return dataClumpsList.some((dataClumps) => {
      const keysInCurrentClump = new Set(
        dataClumps.smellyMethods.map((method) => method.key)
      );
      return (
        keysInCurrentClump.has(anchor) &&
        refactoredKeyList.every((k) => keysInCurrentClump.has(k))
      );
    });
  } else if (type === "smellyFields") {
    return dataClumpsList.some((dataClumps) => {
      const keysInCurrentClump = new Set(
        dataClumps.smellyFields.map((field) => field.key)
      );
      return (
        keysInCurrentClump.has(anchor) &&
        refactoredKeyList.every((k) => keysInCurrentClump.has(k))
      );
    });
  }
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

export function getDataClumpsTypeWithKey(
  dataClumpsList: DataClumpsList[],
  key: string,
  type: "smellyMethods" | "smellyFields"
): DataClumpsType {
  if (type === "smellyMethods") {
    const foundMethods = dataClumpsList
      .flatMap((data) => data.smellyMethods || [])
      .find((smellyMethod) => smellyMethod.key === key);
    return foundMethods || null;
  } else if (type === "smellyFields") {
    const foundFields = dataClumpsList
      .flatMap((data) => data.smellyFields || [])
      .find((smellyField) => smellyField.key === key);
    return foundFields || null;
  }
}

export async function handleUserInputSmellyMethods(
  dataClumpsList: DataClumpsList[],
  outputPath: string
) {
  const dataClumps = removeMetaInfo(dataClumpsList);

  const anchorDataClump = await askAnchorDataClump(dataClumps);

  const refactoredKeys = await askDataClumpsToRefactor(
    dataClumps,
    anchorDataClump,
    "smellyMethods"
  );

  const allInSameGroup = keysInSameGroup(
    dataClumps,
    anchorDataClump,
    refactoredKeys,
    "smellyMethods"
  );

  const useOptimum: boolean = await wantsOptimumSolution();

  if (allInSameGroup) {
    const allKeys = summarizeKeys(refactoredKeys, anchorDataClump);
    const userChoiceGroup = filterDataClumpsList(
      dataClumps,
      allKeys,
      "smellyMethods"
    ) as SmellyMethods[];

    if (useOptimum) {
      createNewClassesFromKeyList(userChoiceGroup, outputPath);
    } else {
      createNewClassesUsingAnchorKeyForSmellyMethods(
        dataClumps,
        outputPath,
        allKeys[0],
        userChoiceGroup
      );
    }
  } else {
    console.log("The keys are not in the same group");
  }
}

export async function handleUserInputSmellyFields(
  dataClumpsList: DataClumpsList[],
  outputPath: string
) {
  const dataClumps = removeMetaInfo(dataClumpsList);

  const anchorDataClump = await askAnchorDataClump(dataClumps);

  const refactoredKeys = await askDataClumpsToRefactor(
    dataClumps,
    anchorDataClump,
    "smellyFields"
  );

  const allInSameGroup = keysInSameGroup(
    dataClumps,
    anchorDataClump,
    refactoredKeys,
    "smellyFields"
  );

  const useOptimum: boolean = await wantsOptimumSolution();

  if (!allInSameGroup) {
    console.log("The keys are not in the same group");
  } else {
    const allKeys = summarizeKeys(refactoredKeys, anchorDataClump);
    const userChoiceGroup = filterDataClumpsList(
      dataClumps,
      allKeys,
      "smellyFields"
    ) as SmellyFields[];
    if (useOptimum) {
      createNewClassesFromKeyListForSmellyFields(userChoiceGroup, outputPath);
    } else {
      createNewClassesUsingAnchorKeyForSmellyFields(
        dataClumps,
        outputPath,
        allKeys[0],
        userChoiceGroup
      );
    }
  }
}
