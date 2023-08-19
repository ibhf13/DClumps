import {
  DataClumpsList,
  SmellyFields,
  SmellyMethods,
} from "../utils/Interfaces";
import * as readline from "readline";
import { removeMetaInfo } from "../utils/newClassUtils";
import {
  createNewClassesFromKeyListForSmellyFields,
  getLeastCommonVariableSet,
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
      keyExistsInDataClumpsList(dataClumpsList, answer)
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
  anchorDataClump: string
): Promise<string[]> {
  let validAnswers: string[] = [];

  while (true) {
    const answer = await readlineAsync(
      "Type 's' to stop \nWhat Data clumps do you want to refactor? "
    );
    if (answer.toLowerCase() === "s") {
      break;
    }
    if (
      isValidPositiveNumber(answer) &&
      keyExistsInDataClumpsList(dataClumpsList, answer) &&
      keysInSameGroup(dataClumpsList, anchorDataClump, [answer])
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
  key: string
): boolean {
  let type = getSmellyType(dataClumpsList, key);
  for (const dataClump of dataClumpsList) {
    if (type === "smellyMethods") {
      if (dataClump.smellyMethods) {
        const foundMethod = dataClump.smellyMethods.find(
          (method) => method.key === key
        );
        if (foundMethod) return true;
      }
    } else if (type === "smellyFields") {
      if (dataClump.smellyFields) {
        const foundField = dataClump.smellyFields.find(
          (field) => field.key === key
        );
        if (foundField) return true;
      }
    }
  }
  return false;
}
function keysInSameGroup(
  dataClumpsList: DataClumpsList[],
  anchor: string,
  refactoredKeyList: string[]
): boolean {
  let type = getSmellyType(dataClumpsList, refactoredKeyList[0]);
  for (const dataClump of dataClumpsList) {
    if (type === "smellyMethods") {
      if (dataClump.smellyMethods) {
        const foundAnchor = dataClump.smellyMethods.find(
          (method) => method.key === anchor
        );
        if (foundAnchor) {
          const foundRefactoredKeys = dataClump.smellyMethods.filter((method) =>
            refactoredKeyList.includes(method.key)
          );
          if (foundRefactoredKeys.length === refactoredKeyList.length) {
            return true;
          }
        }
      }
    } else if (type === "smellyFields") {
      if (dataClump.smellyFields) {
        const foundAnchor = dataClump.smellyFields.find(
          (field) => field.key === anchor
        );
        if (foundAnchor) {
          const foundRefactoredKeys = dataClump.smellyFields.filter((field) =>
            refactoredKeyList.includes(field.key)
          );
          if (foundRefactoredKeys.length === refactoredKeyList.length) {
            return true;
          }
        }
      }
    }
  }
  return false;
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

export function getDataClumpsTypeWithKey(
  dataClumpsList: DataClumpsList[],
  key: string
): SmellyFields | SmellyMethods {
  let type = getSmellyType(dataClumpsList, key);
  for (const dataClump of dataClumpsList) {
    if (type === "smellyMethods") {
      if (dataClump.smellyMethods) {
        const foundMethod = dataClump.smellyMethods.find(
          (method) => method.key === key
        );
        if (foundMethod) return foundMethod;
      }
    } else if (type === "smellyFields") {
      if (dataClump.smellyFields) {
        const foundField = dataClump.smellyFields.find(
          (field) => field.key === key
        );
        if (foundField) return foundField;
      }
    }
  }
  throw new Error("Key not found in Data Clumps List");
}

export function getSmellyType(
  dataClumpsList: DataClumpsList[],
  key: string
): "smellyMethods" | "smellyFields" {
  for (const dataClump of dataClumpsList) {
    if (dataClump.smellyMethods) {
      const foundMethod = dataClump.smellyMethods.find(
        (method) => method.key === key
      );
      if (foundMethod) return "smellyMethods";
    }
    if (dataClump.smellyFields) {
      const foundField = dataClump.smellyFields.find(
        (field) => field.key === key
      );
      if (foundField) return "smellyFields";
    }
  }
  throw new Error("Key not found in Data Clumps List");
}

export async function handleUserInputSmellyFields(
  dataClumpsList: DataClumpsList[],
  outputPath: string,
  minLink: number
) {
  const dataClumps = removeMetaInfo(dataClumpsList);

  const anchorDataClump = await askAnchorDataClump(dataClumps);

  const refactoredKeys = await askDataClumpsToRefactor(
    dataClumps,
    anchorDataClump
  );

  const allInSameGroup = keysInSameGroup(
    dataClumps,
    anchorDataClump,
    refactoredKeys
  );

  if (!allInSameGroup) {
    console.log("The keys are not in the same group");
  } else {
    const allKeys = summarizeKeys(refactoredKeys, anchorDataClump);
    const leastParameterFieldGroup = getLeastCommonVariableSet(
      dataClumps,
      allKeys
    );
    if (leastParameterFieldGroup.length >= minLink) {
      createNewClassesFromKeyListForSmellyFields(
        dataClumps,
        allKeys,
        leastParameterFieldGroup,
        outputPath
      );
    } else {
      console.log("-----------------------");
      console.log(
        "Not enough Data Clumps to create a new class.\n please choose another link"
      );
      console.log("-----------------------\n");

      handleUserInputSmellyFields(dataClumpsList, outputPath, minLink);
    }
  }
}
