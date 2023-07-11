import { ClassDeclaration, Project, PropertyDeclaration } from "ts-morph";
import {
  ClassInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyFields,
} from "../utils/Interfaces";

let smellyFieldGroup: SmellyFields[] = [];
let Data_Clumps_List: DataClumpsList[] = [];

function projectFileList(
  toAnalyzeProjectFolder: string,
  excludeFolders: string[]
): string[] {
  let project = new Project();
  project.addSourceFilesAtPaths(toAnalyzeProjectFolder);

  let sourceFiles = project.getSourceFiles().map((file) => file.getFilePath());

  // Filter out excluded folders
  if (excludeFolders && excludeFolders.length > 0) {
    sourceFiles = sourceFiles.filter((filePath) => {
      return !excludeFolders.some((folder) => filePath.includes(folder));
    });
  }

  return sourceFiles;
}

export function DetectSmellyFields(
  codeAnalyzerProject: Project,
  toAnalyzeProjectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
): DataClumpsList[] {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    // Analysis of classes
    let classesInFile = file.getClasses();
    classesInFile.forEach((cls) => {
      const fields = cls.getProperties(); // Here's where we get the fields
      compareFieldsWithOtherFiles(
        codeAnalyzerProject,
        fields,
        cls,
        file.getFilePath(),
        toAnalyzeProjectFolder,
        minDataClumps,
        excludeFolders
      );
    });
    if (smellyFieldGroup.length > 1) {
      console.log(`\nDetected ${smellyFieldGroup.length} Smelly Fields\n`);
      Data_Clumps_List.push({
        smellyFieldGroup: [...smellyFieldGroup],
      });
      smellyFieldGroup = [];
    }
  });

  return Data_Clumps_List;
}

function compareFieldsWithOtherFiles(
  codeAnalyzerProject: Project,
  fields: PropertyDeclaration[], //first field to check
  clazz: ClassDeclaration,
  filepath: string,
  projectFolder: string,
  mindataclumps: number,
  excludeFolders: string[]
) {
  const projectFiles = projectFileList(projectFolder, excludeFolders);
  let matchFound = false;

  projectFiles.forEach((file) => {
    matchFound = compareWithOtherClassesForFields(
      codeAnalyzerProject,
      fields,
      file, // new file to check
      matchFound,
      mindataclumps
    );
  });

  storeSmellyFields(matchFound, fields, clazz, filepath); // Stores the field if it is "smelly"
}

function compareWithOtherClassesForFields(
  codeAnalyzerProject: Project,
  fields: PropertyDeclaration[], //same first field
  filePath: string,
  matchFound: boolean,
  mindataclumps: number
) {
  const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
  const classesInFile = sourceFile.getClasses();

  classesInFile.forEach((otherClass) => {
    matchFound = findMatchingFields(
      fields,
      otherClass,
      filePath,
      matchFound,
      mindataclumps
    );
  });

  return matchFound;
}

function findMatchingFields(
  fields: PropertyDeclaration[], // original fields
  otherClass: ClassDeclaration, //to compare with
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
) {
  const otherFields: PropertyDeclaration[] = otherClass.getProperties();
  //TOdo compare field with otherFields both are list

  if (otherFields.length >= minDataClumps) {
    if (doParametersMatch(fields, otherFields, minDataClumps)) {
      matchFound = true;

      if (
        !isFieldInDataClumpsList(filePath, otherClass.getName()) &&
        !isFieldInSmellyFieldGroup(filePath, otherClass.getName())
      ) {
        storeFieldInfo(otherFields, otherClass, filePath);
      }
    }
  }

  return matchFound;
}

function doParametersMatch(
  params1: PropertyDeclaration[],
  params2: PropertyDeclaration[],
  minDataClumps: number
) {
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
    if (matchCount >= minDataClumps) return true;
  }

  return false;
}

function isFieldInDataClumpsList(filepath: string, className: string): boolean {
  return Data_Clumps_List.some((dataClump) =>
    dataClump.smellyFieldGroup.some(
      (smellyField) =>
        smellyField.classInfo.className === className &&
        smellyField.classInfo.filepath === filepath
    )
  );
}

function isFieldInSmellyFieldGroup(
  filepath: string,
  className: string
): boolean {
  return smellyFieldGroup.some(
    (smellyField) =>
      smellyField.classInfo.filepath === filepath &&
      smellyField.classInfo.className === className
  );
}

function storeSmellyFields(
  matchFound: boolean,
  field: PropertyDeclaration[],
  clazz: ClassDeclaration,
  filePath: string
) {
  if (matchFound && !isFieldInDataClumpsList(filePath, clazz.getName())) {
    storeFieldInfo(field, clazz, filePath);
  }
}

function storeFieldInfo(
  field: PropertyDeclaration[],
  clazz: ClassDeclaration,
  filepath: string
) {
  const fieldDetails: ParameterInfo[] = field.map((fieldVariable) => ({
    name: fieldVariable.getName(),
    type: fieldVariable.getType().getText(),
    value: fieldVariable.getInitializer()?.getText(),
  }));

  const classDetails: ClassInfo = {
    className: clazz.getName() || "",
    filepath,
  };

  const smellyField: SmellyFields = {
    fieldInfo: fieldDetails,
    classInfo: classDetails,
  };

  smellyFieldGroup.push(smellyField);
}
