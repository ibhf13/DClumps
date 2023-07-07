import { Project } from "ts-morph";
import { DataClumpsList, SmellyMethods } from "../utils/Interfaces";
import { analyzeProjectFiles } from "./DataClumpsDetector";

import { createNewClassesFromDataClumpsList } from "./extractNewClasses";
import { writeFileSync } from "fs";

function main() {
  //initialize the date collection variables
  let codeAnalyzerProject = new Project();
  const MIN_MATCHES = 2;
  const toAnalyzeProjectFolder: string = "./src/**/*.ts";
  const outputPath = "./src/output/extractedClasses/";

  console.log(
    `start analyzing  ${toAnalyzeProjectFolder} for data clumps Dataclumps \n...`
  );

  codeAnalyzerProject.addSourceFilesAtPaths(toAnalyzeProjectFolder);

  // Analyze the project files for data clumps
  let dataClumpsList = analyzeProjectFiles(
    codeAnalyzerProject,
    toAnalyzeProjectFolder,
    MIN_MATCHES
  );
  console.log(`found ${dataClumpsList.length} Dataclumps`);

  writeFileSync(
    "./src/output/jsonDclumps/Data_Clumps_List.json",
    JSON.stringify(dataClumpsList, null, 2)
  );
  console.log("\n\n\nStart refactoring \n...");

  createNewClassesFromDataClumpsList(dataClumpsList, outputPath);
}

// Run the main function
main();
