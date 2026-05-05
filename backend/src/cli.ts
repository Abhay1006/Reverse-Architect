// ============================================================
//  Atlas-TS — CLI Tool
//  Analyze a project directory and print the architecture graph.
//  Usage: npx tsx src/cli.ts parse <directory>
// ============================================================

import { analyzeWithLsp } from './lsp/index.js';
import { buildGraph } from './graph/graph-builder.js';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetDir = args[1];

  if (command !== 'parse' || !targetDir) {
    console.error('Usage: npx tsx src/cli.ts parse <directory>');
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), targetDir);
  console.log(`Parsing project at: ${projectPath}`);

  const parsedFiles = await analyzeWithLsp(projectPath);

  console.log('Building graph...');
  const graph = buildGraph(parsedFiles);

  console.log(JSON.stringify(graph, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
