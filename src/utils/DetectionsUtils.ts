import { Project, PropertyDeclaration, SyntaxKind } from "ts-morph";

export function projectFileList(
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

export function doParametersMatch(
  params1: PropertyDeclaration[],
  params2: PropertyDeclaration[],
  minDataClumps: number
): boolean {
  let matchMap = new Map();

  for (let param1 of params1) {
    for (let param2 of params2) {
      if (
        param1.getName() === param2.getName() &&
        param1.getType().getText() === param2.getType().getText() &&
        hasSameScope(param1, param2)
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

// Helper function to compare scopes
function hasSameScope(
  field1: PropertyDeclaration,
  field2: PropertyDeclaration
): boolean {
  const scope1 = getScope(field1);
  const scope2 = getScope(field2);

  return scope1 === scope2;
}

// Helper function to determine scope
function getScope(field: PropertyDeclaration): string {
  if (field.hasModifier(SyntaxKind.PublicKeyword)) {
    return "public";
  } else if (field.hasModifier(SyntaxKind.PrivateKeyword)) {
    return "private";
  } else if (field.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return "protected";
  } else {
    // Default scope is public if no explicit modifier is provided
    return "public";
  }
}
