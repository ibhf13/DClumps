import {
  ClassDeclaration,
  Node,
  Project,
  PropertyDeclaration,
  SyntaxKind,
} from "ts-morph";
import {
  ClassInfo,
  ParameterInfo,
  DataClumpsList,
  SmellyFields,
  GlobalCalls,
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
  fields: PropertyDeclaration[],
  clazz: ClassDeclaration,
  filepath: string
) {
  const fieldDetails: ParameterInfo[] = fields.map((fieldVariable) => ({
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
    callsInfo: {
      callsList: {
        callsInSame: 0,
        callsGlob: [],
      },
      callsCount: 0,
    },
  };

  analyzeFieldReferences(smellyField, fields, clazz);

  smellyFieldGroup.push(smellyField);
}

function countFieldReferencesInSameClass(
  references: Node[],
  clazz: ClassDeclaration
): number {
  const referencedClasses: string[] = [];

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass) continue;

    const isSameClass = refClass.getName() === clazz.getName();
    if (isSameClass) {
      const className = refClass.getName();
      if (!referencedClasses.includes(className)) {
        referencedClasses.push(className);
      }
    }
  }

  return referencedClasses.length;
}

function getGlobalFieldReferences(
  references: Node[],
  clazz: ClassDeclaration
): GlobalCalls[] {
  let globalCalls: GlobalCalls[] = [];
  const referencedClasses = new Map<string, ClassInfo>();

  for (const ref of references) {
    const refClass = ref.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!refClass || refClass.getName() === clazz.getName()) continue;

    const key = refClass.getName() || refClass.getSourceFile().getFilePath();
    if (referencedClasses.has(key)) continue;

    let foundGlobalCall = globalCalls.find(
      (call) =>
        call.classInfo.className === refClass.getName() &&
        call.classInfo.filepath === refClass.getSourceFile().getFilePath()
    );

    if (foundGlobalCall) {
      foundGlobalCall.callsGlobCount++;
    } else {
      globalCalls.push({
        classInfo: {
          className: refClass.getName() || "",
          filepath: refClass.getSourceFile().getFilePath(),
        },
        callsGlobCount: 1,
      });
    }

    referencedClasses.set(key, {
      className: refClass.getName() || "",
      filepath: refClass.getSourceFile().getFilePath(),
    });
  }

  return globalCalls;
}

function analyzeFieldReferences(
  smellyField: SmellyFields,
  fields: PropertyDeclaration[],
  clazz: ClassDeclaration
) {
  let references: Node[] = [];

  fields.forEach((field) => {
    references = references.concat(field.findReferencesAsNodes());
  });

  const callsInSameClass = countFieldReferencesInSameClass(references, clazz);
  const globalCalls = getGlobalFieldReferences(references, clazz);

  let totalCallsGlobCount = 0;
  globalCalls.forEach((call) => {
    totalCallsGlobCount += call.callsGlobCount;
  });

  smellyField.callsInfo.callsList = {
    callsInSame: callsInSameClass,
    callsGlob: globalCalls,
  };

  smellyField.callsInfo.callsCount = callsInSameClass + totalCallsGlobCount;
}
