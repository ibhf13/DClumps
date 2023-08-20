import { Project } from "ts-morph";
import { writeFileSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import { ClassInfo, DataClumpsList, MethodInfo } from "../utils/Interfaces";
import { DetectSmellyFields } from "./DataClumpsDetector";
import { handleUserInputSmellyFields } from "./UserInput";

function getDataClumpsList(filePath: string): DataClumpsList[] {
  try {
    const fileContents = fs.readFileSync(path.resolve(filePath), "utf-8");
    const data = JSON.parse(fileContents);

    return data.map((item: any) => {
      const smellyMethods = item.smellyMethods.map((smellyMethod: any) => {
        const { methodInfo, classInfo, callsList, callsCount } = smellyMethod;

        const mappedMethodInfo: MethodInfo = {
          methodName: methodInfo.methodName,
          parameters: methodInfo.parameters.map((parameter: any) => ({
            name: parameter.name,
            type: parameter.type,
            value: parameter.value,
          })),
        };

        const mappedClassInfo: ClassInfo = {
          className: classInfo.className,
          filepath: classInfo.filepath,
        };

        const mappedCallsList = {
          callsInSame: callsList.callsInSame,
          callsGlob: callsList.callsGlob.map((call: any) => ({
            classInfo: {
              className: call.classInfo.className,
              filepath: call.classInfo.filepath,
            },
            callsGlobCount: call.callsGlobCount,
          })),
        };

        return {
          methodInfo: mappedMethodInfo,
          classInfo: mappedClassInfo,
          callsList: mappedCallsList,
          callsCount,
        };
      });
      return { smellyMethods };
    });
  } catch (error) {
    console.error("Error reading and parsing file", error);
    return [];
  }
}

async function main() {
  //initialize the date collection variables
  let codeAnalyzerProject = new Project();

  const MIN_MATCHES = 3;
  const toAnalyzeProjectFolder: string = "./src/**/*.ts";
  const outputPath = "./src/output/extractedClasses/";
  let excludedFolders = ["node_modules"];

  console.log(
    `start analyzing  ${toAnalyzeProjectFolder} for dataclumps \n...`
  );

  codeAnalyzerProject.addSourceFilesAtPaths(toAnalyzeProjectFolder);

  let dataClumpsListWithFields = DetectSmellyFields(
    codeAnalyzerProject,
    toAnalyzeProjectFolder,
    MIN_MATCHES,
    excludedFolders
  );

  console.log(
    `found ${dataClumpsListWithFields[0].metaInfo.numberOfDataClumpsGroups} Data Clumps Groups`
  );

  writeFileSync(
    "./src/output/jsonDclumps/Data_Clumps_List_With_Fields.json",
    JSON.stringify(dataClumpsListWithFields, null, 2)
  );
  console.log("Create new Classes for Smelly Fields");
  handleUserInputSmellyFields(
    dataClumpsListWithFields,
    outputPath,
    MIN_MATCHES
  );
}

// Run the main function
main();
