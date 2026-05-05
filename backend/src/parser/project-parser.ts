// ============================================================
//  Atlas-TS — Database Schema Parser
//  Parses .prisma and .sql files to extract table definitions.
//  (The old ts-morph parseProject function has been replaced
//   by the LSP pipeline in backend/src/lsp/)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { ParsedFile, ParsedDatabase } from '../../../shared/types.js';

function walkDir(dir: string, ext: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules')) {
        results = results.concat(walkDir(fullPath, ext));
      }
    } else {
      if (ext.some(e => fullPath.endsWith(e))) results.push(fullPath);
    }
  }
  return results;
}

export function parseDatabaseSchemas(projectPath: string): ParsedFile[] {
  console.log(`Scanning for database schemas in ${projectPath}...`);
  const dbFiles = walkDir(projectPath, ['.prisma', '.sql']);
  
  const parsedFiles: ParsedFile[] = [];

  for (const file of dbFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const tables: ParsedDatabase[] = [];

    if (file.endsWith('.prisma')) {
      const modelRegex = /model\s+(\w+)\s+{/g;
      let match;
      while ((match = modelRegex.exec(content)) !== null) {
        tables.push({
          kind: 'database',
          name: match[1] || 'unknown_model',
          columns: [],
          lineCount: 0
        });
      }
    } else if (file.endsWith('.sql')) {
      const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
      let match;
      while ((match = tableRegex.exec(content)) !== null) {
        tables.push({
          kind: 'database',
          name: match[1] || 'unknown_table',
          columns: [],
          lineCount: 0
        });
      }
    }

    if (tables.length > 0) {
      parsedFiles.push({
        kind: 'file',
        name: path.basename(file),
        filePath: file,
        imports: [],
        classes: [],
        interfaces: [],
        functions: [],
        databaseTables: tables,
        lineCount: content.split('\n').length
      });
    }
  }

  return parsedFiles;
}
