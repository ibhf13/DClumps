import { Project } from "ts-morph";

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
  params1: any[], // use a more specific type if you can, like ParameterDeclaration[]
  params2: any[],
  minDataClumps: number
): boolean {
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
