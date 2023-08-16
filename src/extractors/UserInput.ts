import {
  createNewClassesFromKeyList,
  createNewClassesUsingAnchorKey,
} from "./NewClassSmellyMethods";
import { DataClumpsList } from "../utils/Interfaces";
import * as readline from "readline";
import { filterSmellyMethods, removeMetaInfo } from "../utils/newClassUtils";

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
      keyExistsInDataClumpsList(dataClumpsList, answer)
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
      keyExistsInDataClumpsList(dataClumpsList, answer)
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

function keyExistsInDataClumpsList(
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

export async function handleUserInput(
  dataClumpsList: DataClumpsList[],
  outputPath: string
) {
  const dataClumps = removeMetaInfo(dataClumpsList);

  const anchorDataClump = await askAnchorDataClump(dataClumps);

  const refactoredKeys = await askDataClumpsToRefactor(dataClumps);

  const allInSameGroup = keysInSameGroup(
    dataClumps,
    anchorDataClump,
    refactoredKeys
  );

  const useOptimum: boolean = await wantsOptimumSolution();

  if (allInSameGroup) {
    const allKeys = summarizeKeys(refactoredKeys, anchorDataClump);
    if (useOptimum) {
      const userChoiceGroup = filterSmellyMethods(dataClumps, allKeys);
      createNewClassesFromKeyList(userChoiceGroup, outputPath);
    } else {
      createNewClassesUsingAnchorKey(dataClumps, outputPath, allKeys);
    }
  } else {
    console.log("The keys are not in the same group");
  }
}
