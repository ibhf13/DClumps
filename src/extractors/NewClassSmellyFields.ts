import { Project } from "ts-morph";
import {
  DataClumpsList,
  ParameterInfo,
  SmellyFields,
  SmellyMethods,
  SmellyTypes,
} from "../utils/Interfaces";
import {
  exportNewFileData,
  filterDataClumpsList,
  generateClassVariables,
  generateConstructor,
  generateGettersAndSetters,
  generateUniqueFileName,
  initializeNewClass,
} from "../utils/newClassUtils";
import { refactorSmellyFields } from "./RefactoringSmellyFields";
import { toCamelCase } from "../utils/RefactorUtils";
import { getSmellyType } from "./UserInput";
import { refactorSmellyMethods } from "./RefactoringSmellyMethods";

const project = new Project();

export function createNewClassesFromKeyListForSmellyFields(
  dataClumps: DataClumpsList[],
  keys: string[],
  leastParameterFieldGroup: ParameterInfo[],
  outputPath: string
) {
  let newClassName = getNewClassNameFromFieldGroup(leastParameterFieldGroup);
  const fileName = generateUniqueFileName(newClassName, outputPath);

  const newClassDeclaration = createAndGetNewClass(
    newClassName,
    fileName,
    leastParameterFieldGroup,
    outputPath
  );

  const newClassInfo = exportNewFileData(
    newClassDeclaration,
    fileName,
    leastParameterFieldGroup,
    outputPath
  );
  project.saveSync();
  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
  const typeOfDataClumps = getSmellyType(dataClumps, keys[0]);

  if (typeOfDataClumps === "smellyMethods") {
    let smellyMethodsGroup = filterDataClumpsList(
      dataClumps,
      keys
    ) as SmellyMethods[];
    refactorSmellyMethods(newClassInfo, smellyMethodsGroup, project);
  } else if (typeOfDataClumps === "smellyFields") {
    let smellyFieldsGroup = filterDataClumpsList(
      dataClumps,
      keys
    ) as SmellyFields[];
    refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);
  }
}

export function getLeastCommonVariableSet(
  dataClumps: DataClumpsList[],
  keys: string[]
): ParameterInfo[] {
  let allVariable;
  let type = getSmellyType(dataClumps, keys[0]);

  if (type === "smellyMethods") {
    let userChoice = filterDataClumpsList(dataClumps, keys) as SmellyMethods[];
    allVariable = userChoice.map(
      (smellyMethod) => smellyMethod.methodInfo.parameters
    );
  }

  if (type === "smellyFields") {
    let userChoice = filterDataClumpsList(dataClumps, keys) as SmellyFields[];
    allVariable = userChoice!.map((smellyField) => smellyField.fieldInfo);
  }

  const commonVariables = allVariable.reduce(
    (currentParameters, nextParameters) =>
      currentParameters.filter((currentParameter) =>
        nextParameters?.some(
          (nextParameter) =>
            currentParameter.name === nextParameter.name &&
            currentParameter.type === nextParameter.type
        )
      )
  );
  return commonVariables;
}

//TODO: maybe can be extracted
function getNewClassNameFromFieldGroup(fieldInfo: ParameterInfo[]) {
  return fieldInfo.map((field) => toCamelCase(field.name)).join("");
}

function createAndGetNewClass(
  newClassName: string,
  fileName: string,
  fieldInfo: ParameterInfo[],
  outputPath: string
) {
  const newClassDeclaration = initializeNewClass(
    fileName,
    newClassName,
    outputPath,
    project
  );
  generateClassVariables(fieldInfo, newClassDeclaration);
  generateConstructor(fieldInfo, newClassDeclaration);
  generateGettersAndSetters(fieldInfo, newClassDeclaration);

  return newClassDeclaration;
}
