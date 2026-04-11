import { parseProject } from './parser/project-parser.js';
import { extractClass } from './parser/extractors/class-extractor.js';
import { extractInterface } from './parser/extractors/interface-extractor.js';
import { extractFunction } from './parser/extractors/function-extractor.js';
import { extractImport } from './parser/extractors/import-extractor.js';
import type { ParsedFile } from '../../shared/types.js';
import { buildGraph } from './graph/graph-builder.js';
import * as path from 'path';

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetDir = args[1];

  if (command !== 'parse' || !targetDir) {
    console.error('Usage: npx ts-node src/cli.ts parse <directory>');
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), targetDir);
  console.log(`Parsing project at: ${projectPath}`);

  const sourceFiles = parseProject(projectPath);
  const parsedFiles: ParsedFile[] = [];

  for (const file of sourceFiles) {
    const classes = file.getClasses().map(extractClass);
    const interfaces = file.getInterfaces().map(extractInterface);
    const functions = file.getFunctions().map(extractFunction);
    const imports = file.getImportDeclarations().map(extractImport);

    const parsedFile: ParsedFile = {
      kind: 'file',
      name: file.getBaseName(),
      filePath: file.getFilePath(),
      classes,
      interfaces,
      functions,
      imports
    };

    parsedFiles.push(parsedFile);
  }

  console.log('Building graph...');
  const graph = buildGraph(parsedFiles);

  console.log(JSON.stringify(graph, null, 2));
}

main();
