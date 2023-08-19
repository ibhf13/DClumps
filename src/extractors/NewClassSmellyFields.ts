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

const project = new Project();
// export function createNewClassesUsingAnchorKeyForSmellyFields(
//   dataClumpsList: DataClumpsList[],
//   outputPath: string,
//   key: string,
//   userChoiceGroup: SmellyFields[]
// ) {
//   const anchorSmellyMethod = getDataClumpsTypeWithKey(
//     dataClumpsList,
//     key
//   ) as SmellyFields;
//   createNewClassUsingAnchorKey(anchorSmellyMethod, userChoiceGroup, outputPath);

//   project.saveSync();
// }

export function createNewClassesFromKeyListForSmellyFields(
  dataClumps: DataClumpsList[],
  outputPath: string,
  keys: string[]
) {
  const leastParameterFieldGroup = getLeastCommonVariableSet(dataClumps, keys);
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
  const userChoiceGroup = filterDataClumpsList(dataClumps, keys);

  //refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);

  console.log(
    `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
  );
}

// function createNewClassUsingAnchorKey(
//   anchorFieldsClass: SmellyFields,
//   smellyFieldsGroup: SmellyFields[],
//   outputPath: string
// ) {
//   let newClassName = getNewClassNameFromFieldGroup(anchorFieldsClass.fieldInfo);
//   const fileName = generateUniqueFileName(
//     anchorFieldsClass.classInfo.className + "_" + newClassName,
//     outputPath
//   );

//   const newClassDeclaration = createAndGetNewClass(
//     newClassName,
//     fileName,
//     anchorFieldsClass.fieldInfo,
//     outputPath
//   );

//   const newClassInfo = exportNewFileData(
//     newClassDeclaration,
//     fileName,
//     anchorFieldsClass.fieldInfo,
//     outputPath
//   );
//   project.saveSync();

//   refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);

//   console.log(
//     `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
//   );
// }

// function createNewClassUsingOptimum(
//   smellyFieldsGroup: DataClumpsList[],
//   outputPath: string,
//   keys: string[]
// ) {
//   const userChoiceGroup = filterDataClumpsList(dataClumps, allKeys);

//   const leastParameterFieldGroup = getLeastCommonVariableSet(smellyFieldsGroup);
//   let newClassName = getNewClassNameFromFieldGroup(leastParameterFieldGroup);
//   const fileName = generateUniqueFileName(newClassName, outputPath);

//   const newClassDeclaration = createAndGetNewClass(
//     newClassName,
//     fileName,
//     leastParameterFieldGroup,
//     outputPath
//   );

//   const newClassInfo = exportNewFileData(
//     newClassDeclaration,
//     fileName,
//     leastParameterFieldGroup,
//     outputPath
//   );
//   project.saveSync();

//   refactorSmellyFields(newClassInfo, smellyFieldsGroup, project);

//   console.log(
//     `Created new class at ${newClassInfo.filepath} with name ${newClassInfo.className}`
//   );
// }

function getLeastCommonVariableSet(
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
    console.log("\n\tuserChoice  ", userChoice);
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
