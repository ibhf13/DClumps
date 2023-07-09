import {
  ClassDeclaration,
  MethodDeclaration,
  Node,
  ParameterDeclaration,
  Project,
  PropertyDeclaration,
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
      fields.forEach((field) => {
        compareFieldsWithOtherFiles(
          codeAnalyzerProject,
          field,
          cls,
          file.getFilePath(),
          toAnalyzeProjectFolder,
          minDataClumps,
          excludeFolders
        );
      });

      if (smellyFieldGroup.length > 1) {
        console.log(
          `Detected ${
            smellyFieldGroup.length
          } smelly fields in class: ${cls.getName()}`
        );
        Data_Clumps_List.push({
          smellyFieldGroup: [...smellyFieldGroup],
        });
        smellyFieldGroup = [];
      }
    });
  });

  return Data_Clumps_List;
}

function compareFieldsWithOtherFiles(
  codeAnalyzerProject: Project,
  field: PropertyDeclaration,
  clazz: ClassDeclaration,
  filepath: string,
  projectFolder: string,
  mindataclumps: number,
  excludeFolders: string[]
) {
  const projectFiles = projectFileList(projectFolder, excludeFolders); // You should define projectFileList() to return all project files
  let matchFound = false;

  projectFiles.forEach((filePath) => {
    matchFound = compareWithOtherClassesForFields(
      codeAnalyzerProject,
      field,
      filePath,
      matchFound,
      mindataclumps
    );
  });

  storeSmellyFields(matchFound, field, clazz, filepath); // Stores the field if it is "smelly"
}

function compareWithOtherClassesForFields(
  codeAnalyzerProject: Project,
  field: PropertyDeclaration,
  filePath: string,
  matchFound: boolean,
  mindataclumps: number
) {
  const sourceFile = codeAnalyzerProject.getSourceFile(filePath);
  const classesInFile = sourceFile.getClasses();

  classesInFile.forEach((otherClass) => {
    matchFound = findMatchingFields(
      field,
      otherClass,
      filePath,
      matchFound,
      mindataclumps
    );
  });

  return matchFound;
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
      smellyField.classInfo.className === className &&
      smellyField.classInfo.filepath === filepath
  );
}

function storeSmellyFields(
  matchFound: boolean,
  field: PropertyDeclaration,
  clazz: ClassDeclaration,
  filepath: string
) {
  if (
    matchFound &&
    !isFieldInDataClumpsList(field.getName(), clazz.getName())
  ) {
    storeFieldInfo(field, clazz, filepath);
  }
}

function storeFieldInfo(
  field: PropertyDeclaration,
  clazz: ClassDeclaration,
  filepath: string
) {
  const classFields = clazz.getProperties();
  const fieldDetails: ParameterInfo[] = classFields.map((fieldVariable) => ({
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

function findMatchingFields(
  field: PropertyDeclaration,
  otherClass: ClassDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
) {
  const otherFields = otherClass.getProperties();

  otherFields.forEach((otherField) => {
    if (otherField !== field) {
      if (doParametersMatch(field, otherFields, minDataClumps)) {
        matchFound = true;
        if (
          !isFieldInDataClumpsList(field.getName(), otherClass.getName()) &&
          !isFieldInSmellyFieldGroup(field.getName(), otherClass.getName())
        ) {
          storeFieldInfo(field, otherClass, filePath);
        }
      }
    }
  });

  return matchFound;
}
function doParametersMatch(params1, params2, minDataClumps: number) {
  let matchMap = new Map();
  console.log(params1);

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
