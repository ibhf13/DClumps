import { Project } from "ts-morph";
import { DataClumpsList, SmellyMethods } from "../utils/Interfaces";
import { analyzeProjectFiles } from "./DataClumpsDetector";

import { createNewClassesFromDataClumpsList } from "./extractNewClasses";
import { writeFileSync } from "fs";

function main() {
  //initialize the date collection variables

  let codeAnalyzerProject = new Project();
  const MIN_MATCHES = 2;
  let toAnalyzeProjectFolder: string = "./src/**/*.ts";

  codeAnalyzerProject.addSourceFilesAtPaths(toAnalyzeProjectFolder);

  // Analyze the project files for data clumps
  let dataClumpsList = analyzeProjectFiles(
    codeAnalyzerProject,
    toAnalyzeProjectFolder,
    MIN_MATCHES
  );
  createNewClassesFromDataClumpsList(dataClumpsList);

  console.log(`found ${dataClumpsList.length} Dataclumps`);

  writeFileSync(
    "./src/output/jsonDclumps/Data_Clumps_List.json",
    JSON.stringify(dataClumpsList, null, 2)
  );
}

// Run the main function
main();
