import { Project, SourceFile } from "ts-morph";

let project = new Project();
let untrackedFiles: SourceFile[] = [];

function initializeTracking() {
  // Step 1: Setup the project and read the files
  const sourceFiles = project.addSourceFilesAtPaths("./test/**/*.ts");

  // Step 1.1: Only consider files with a `.ts` extension
  const tsFiles = sourceFiles.filter((file) => file.getExtension() === ".ts");

  // Step 1.2: Exclude files from `node_modules` and other non-source code directories
  const filteredFiles = tsFiles.filter(
    (file) => !file.getFilePath().includes("node_modules")
  );

  // Step 2: Implement a tracking mechanism to keep track of files that need to be inspected
  untrackedFiles = [...filteredFiles]; // assuming all files are untracked initially
}

function parseFiles() {
  // Step 2.1: For each untracked TS file, parse the code into an Abstract Syntax Tree (AST)
  untrackedFiles.forEach((file) => {
    const ast = file.getFullText(); // Getting the text as AST
    console.log(ast);
  });
}

function filterFilesWithFunctions() {
  // Step 2.2: Exclude files without functions to optimize the tracking process
  untrackedFiles = untrackedFiles.filter((file) => {
    const functions = file.getFunctions();
    return functions.length > 0;
  });

  console.log(untrackedFiles);
}

// Use the functions
initializeTracking();
parseFiles();
filterFilesWithFunctions();
