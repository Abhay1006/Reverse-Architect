import { Project, SourceFile } from 'ts-morph';

/**
 * Parses a TypeScript project and extracts source files for further analysis.
 * 
 * @param projectPath The absolute or relative path to the project directory.
 * @returns Array of ts-morph SourceFile objects representing the project code.
 */
export function parseProject(projectPath: string): SourceFile[] {
  console.log(`Initializing ts-morph project...`);
  
  // Create a Project instance from ts-morph
  const project = new Project({
    compilerOptions: {
      allowJs: true,
    }
  });

  console.log(`Adding source files from ${projectPath}...`);
  
  // Add source files from the given path (*.ts, *.tsx, *.js, *.jsx)
  // We make sure it captures all files recursively using the glob pattern.
  project.addSourceFilesAtPaths(`${projectPath}/**/*.{ts,tsx,js,jsx}`);

  // Retrieve all discovered source files
  const allFiles = project.getSourceFiles();

  // Filter out node_modules and test files
  const sourceFiles = allFiles.filter(file => {
    const filePath = file.getFilePath();
    return (
      !filePath.includes('/node_modules/') &&
      !filePath.includes('.test.ts') &&
      !filePath.includes('.spec.ts') &&
      !filePath.includes('.test.tsx') &&
      !filePath.includes('.spec.tsx')
    );
  });

  console.log(`Found ${sourceFiles.length} valid source files to parse.`);
  
  return sourceFiles;
}
