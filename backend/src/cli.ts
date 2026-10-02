// ============================================================
//  Atlas — CLI Tool
//  Analyze a project directory and print the same JSON the
//  analyze API returns.
//  Usage: npx tsx src/cli.ts parse <directory> > graph.json
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { analyzeProjectDir } from './api/analyzer-pipeline.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetDir = args[1];

  if (command !== 'parse' || !targetDir) {
    console.error('Usage: npx tsx src/cli.ts parse <directory>');
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), targetDir);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    console.error(`Not a directory: ${projectPath}`);
    process.exit(1);
  }

  // The analyzers log progress with console.log. Route all of it to stderr so
  // stdout carries nothing but the JSON document and can be piped or redirected.
  console.log = console.error;
  console.info = console.error;

  console.error(`Parsing project at: ${projectPath}`);
  const result = await analyzeProjectDir(projectPath);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
