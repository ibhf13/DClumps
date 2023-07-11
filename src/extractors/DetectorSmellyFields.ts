import { ClassDeclaration, Project, PropertyDeclaration } from "ts-morph";
import {
  ClassInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyFields,
} from "../utils/Interfaces";
import { doParametersMatch, projectFileList } from "../utils/DetectionsUtils";

let smellyFieldGroup: SmellyFields[] = [];
let Data_Clumps_List: DataClumpsList[] = [];

export function DetectSmellyFields(
  codeAnalyzerProject: Project,
  toAnalyzeProjectFolder: string,
  minDataClumps: number,
  excludeFolders: string[]
): DataClumpsList[] {
  let sourceFiles = codeAnalyzerProject.getSourceFiles();

  sourceFiles.forEach((file) => {
    let classesInFile = file.getClasses();
    classesInFile.forEach((cls) => {
      const fields = cls.getProperties();
      compareFieldsWithOtherFiles(
        codeAnalyzerProject,
        fields,
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
  fields: PropertyDeclaration[],
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
      file,
      matchFound,
      mindataclumps
    );
  });
}

function compareWithOtherClassesForFields(
  codeAnalyzerProject: Project,
  fields: PropertyDeclaration[],
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
  fields: PropertyDeclaration[],
  otherClass: ClassDeclaration,
  filePath: string,
  matchFound: boolean,
  minDataClumps: number
) {
  const otherFields: PropertyDeclaration[] = otherClass.getProperties();

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
