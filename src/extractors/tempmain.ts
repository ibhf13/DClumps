import { Project, MethodDeclaration, ParameterDeclaration } from "ts-morph";
import { writeFileSync } from "fs";
import * as path from "path";

// Define smellymethodGroup and Data_Clumps_List
let smellymethodGroup: MethodDeclaration[] = [];
let Data_Clumps_List: any[] = [];

// Create a new Project instance and add all the TypeScript files in the test folder
const project = new Project();
project.addSourceFilesAtPaths(path.resolve("./test/**/*.ts"));

// Get all source files
const sourceFiles = project.getSourceFiles();

// Iterate over each file
for (const file of sourceFiles) {
  // Get all the classes in each file
  const classes = file.getClasses();
  // Iterate over each class
  for (const cls of classes) {
    // Get all methods in each class
    const methods = cls.getMethods();
    // Check if there are at least 2 methods in the class
    if (methods.length > 1) {
      // Iterate over each method
      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        // Get all parameters of the method
        const parameters = method.getParameters();
        // Check if the method has more than 2 parameters
        if (parameters.length > 2) {
          // Check if the method exists in Data_Clumps_List, if not, add it to smellymethodGroup
          if (!methodExistsInDataClumps(method.getName(), file.getFilePath())) {
            const anchorMethod = createAnchorMethod(
              method,
              parameters,
              file.getFilePath(),
              cls.getName()
            );
            smellymethodGroup.push(anchorMethod);
          }
          // Check other methods in the same class
          for (let j = 0; j < methods.length; j++) {
            if (i !== j) {
              const otherMethod = methods[j];
              const otherParameters = otherMethod.getParameters();
              // Check if the other method has more than two parameters and if they match with the anchor method
              if (
                otherParameters.length > 2 &&
                parametersMatch(parameters, otherParameters)
              ) {
                if (
                  !methodExistsInSmellyGroup(
                    otherMethod.getName(),
                    file.getFilePath()
                  )
                ) {
                  smellymethodGroup.push(otherMethod);
                }
              }
            }
          }
        }
        // If smellymethodGroup contains more than one element, save it to Data_Clumps_List and clear smellymethodGroup
        if (smellymethodGroup.length > 1) {
          Data_Clumps_List.push(smellymethodGroup);
          smellymethodGroup = [];
        }
      }
    }
  }
}

// Save Data_Clumps_List to a JSON file
writeFileSync("./data_clumps.json", JSON.stringify(Data_Clumps_List), "utf8");

// Function to check if a method already exists in Data_Clumps_List
function methodExistsInDataClumps(
  methodName: string,
  filePath: string
): boolean {
  for (const group of Data_Clumps_List) {
    for (const method of group) {
      if (method.name === methodName && method.filePath === filePath) {
        return true;
      }
    }
  }
  return false;
}

// Function to create an anchor method
function createAnchorMethod(
  method: MethodDeclaration,
  parameters: ParameterDeclaration[],
  filePath: string,
  className: string
) {
  let parameterInfoList = parameters.map((parameter) => {
    return {
      name: parameter.getName(),
      type: parameter.getType().getText(),
      value: parameter.getInitializer()
        ? parameter.getInitializer()!.getText()
        : undefined,
    };
  });
  return {
    name: method.getName(),
    parameters: parameterInfoList,
    classInfo: {
      filePath: filePath,
      className: className,
    },
  };
}

// Function to check if parameters match between two methods
function parametersMatch(
  parameters1: ParameterDeclaration[],
  parameters2: ParameterDeclaration[]
): boolean {
  // Sort parameters by their names for comparison
  let sortedParams1 = parameters1.sort((a, b) =>
    a.getName().localeCompare(b.getName())
  );
  let sortedParams2 = parameters2.sort((a, b) =>
    a.getName().localeCompare(b.getName())
  );
  for (let i = 0; i < sortedParams1.length; i++) {
    if (
      sortedParams1[i].getName() !== sortedParams2[i].getName() ||
      sortedParams1[i].getType().getText() !==
        sortedParams2[i].getType().getText()
    ) {
      return false;
    }
  }
  return true;
}

// Function to check if a method already exists in smellymethodGroup
function methodExistsInSmellyGroup(
  methodName: string,
  filePath: string
): boolean {
  for (const method of smellymethodGroup) {
    if (method.name === methodName && method.filePath === filePath) {
      return true;
    }
  }
  return false;
}
