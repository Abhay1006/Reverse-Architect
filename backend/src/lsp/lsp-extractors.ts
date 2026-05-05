// ============================================================
//  Atlas-TS — LSP Extractors (Orchestrator)
//  Orchestrates the full LSP-based extraction pipeline:
//  1. Opens project via LSP client
//  2. Queries document symbols for each file
//  3. Resolves imports using textDocument/definition
//  4. Builds call edges using callHierarchy
//  5. Converts everything to ParsedFile[] via the adapter
// ============================================================

import * as path from 'path';
import * as fs from 'fs';
import { LspClient, type LspClientOptions } from './lsp-client.js';
import { adaptSymbolsToParsedFile, extractImportsFromSource, parseImportsFromText } from './lsp-adapter.js';
import { uriToPath, pathToUri } from './lsp-types.js';
import type { ParsedFile, ParsedImport } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
//  Main Extraction Function
// ---------------------------------------------------------------------------

/**
 * Analyze a project using the LSP pipeline.
 * This is the LSP equivalent of the old `parseProject()` function.
 * 
 * @param projectPath Absolute path to the project directory.
 * @param opts Optional LSP client configuration.
 * @returns Array of ParsedFile objects, ready for the graph builder.
 */
export async function analyzeWithLsp(
  projectPath: string,
  opts?: LspClientOptions,
): Promise<ParsedFile[]> {
  const client = new LspClient({
    verbose: false,
    ...opts,
  });

  try {
    // 1. Open the project — starts LSP server, opens all files
    console.log(`[LSP] Opening project: ${projectPath}`);
    const filePaths = await client.openProject(projectPath);
    console.log(`[LSP] Project opened with ${filePaths.length} files`);

    // 2. Process each file
    const parsedFiles: ParsedFile[] = [];
    const filePathSet = new Set(filePaths);
    
    // Build a map of relative paths for import resolution
    const relativePathMap = new Map<string, string>();
    for (const fp of filePaths) {
      const rel = path.relative(projectPath, fp).split(path.sep).join('/');
      relativePathMap.set(fp, rel);
    }

    for (const filePath of filePaths) {
      try {
        // 2a. Get document symbols from LSP
        const symbols = await client.getDocumentSymbols(filePath);

        // 2b. Extract and resolve imports
        const imports = await resolveImports(filePath, projectPath, filePathSet, client);

        // 2c. Convert LSP symbols → ParsedFile
        const parsed = adaptSymbolsToParsedFile(filePath, symbols, imports);

        // 2d. Make file path relative to project root
        parsed.filePath = relativePathMap.get(filePath) || parsed.filePath;

        // 2e. Fix import resolved paths to be relative too
        for (const imp of parsed.imports) {
          if (imp.resolvedPath) {
            const absResolved = imp.resolvedPath;
            if (relativePathMap.has(absResolved)) {
              imp.resolvedPath = relativePathMap.get(absResolved);
            } else {
              // Try to make it relative
              imp.resolvedPath = path.relative(projectPath, absResolved).split(path.sep).join('/');
            }
          }
        }

        parsedFiles.push(parsed);
      } catch (err) {
        console.error(`[LSP] Failed to process ${filePath}:`, err);
        // Continue with other files
      }
    }

    console.log(`[LSP] Successfully parsed ${parsedFiles.length} files`);

    // 3. Enhance with call hierarchy data (best-effort)
    await enhanceWithCallHierarchy(client, parsedFiles, projectPath);

    return parsedFiles;
  } finally {
    // Always clean up the LSP server
    await client.close();
  }
}

// ---------------------------------------------------------------------------
//  Import Resolution
// ---------------------------------------------------------------------------

/**
 * Extract imports from a file and resolve their targets using LSP.
 */
async function resolveImports(
  filePath: string,
  projectPath: string,
  allFilePaths: Set<string>,
  client: LspClient,
): Promise<ParsedImport[]> {
  // Parse imports from source text
  const rawImports = extractImportsFromSource(filePath);

  // Resolve each import's target file
  for (const imp of rawImports) {
    if (!imp.moduleSpecifier.startsWith('.')) {
      // External module (npm package) — skip resolution
      continue;
    }

    // Try to resolve the import target
    const resolvedPath = resolveImportTarget(filePath, imp.moduleSpecifier, allFilePaths);
    if (resolvedPath) {
      imp.resolvedPath = resolvedPath;
    }
  }

  return rawImports;
}

/**
 * Resolve a relative import specifier to an absolute file path.
 */
function resolveImportTarget(
  importingFile: string,
  moduleSpecifier: string,
  knownFiles: Set<string>,
): string | undefined {
  const importDir = path.dirname(importingFile);
  const resolved = path.resolve(importDir, moduleSpecifier);
  const normalized = resolved.split(path.sep).join('/');

  // Try exact match
  if (knownFiles.has(normalized)) return normalized;

  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of extensions) {
    const candidate = normalized + ext;
    if (knownFiles.has(candidate)) return candidate;
  }

  // Try index files
  for (const ext of extensions) {
    const candidate = normalized + '/index' + ext;
    if (knownFiles.has(candidate)) return candidate;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
//  Call Hierarchy Enhancement
// ---------------------------------------------------------------------------

/**
 * Enhance parsed files with accurate call hierarchy information from LSP.
 * This replaces the text-based calledFunctions extraction with LSP-powered
 * outgoing call analysis for improved accuracy.
 */
async function enhanceWithCallHierarchy(
  client: LspClient,
  parsedFiles: ParsedFile[],
  projectPath: string,
): Promise<void> {
  console.log('[LSP] Enhancing with call hierarchy data...');

  let enhancedCount = 0;
  let skippedCount = 0;

  for (const file of parsedFiles) {
    const absolutePath = path.resolve(projectPath, file.filePath);

    // Process functions
    for (const fn of file.functions) {
      try {
        // Find the function's position by searching for its name in the source
        const position = findSymbolPosition(absolutePath, fn.name);
        if (!position) {
          skippedCount++;
          continue;
        }

        // Prepare call hierarchy at the function's position
        const items = await client.prepareCallHierarchy(absolutePath, position);
        if (items.length === 0) {
          skippedCount++;
          continue;
        }

        // Get outgoing calls
        const outgoing = await client.getOutgoingCalls(items[0]!);
        if (outgoing.length > 0) {
          fn.calledFunctions = outgoing.map(call => call.to.name);
          enhancedCount++;
        }
      } catch {
        skippedCount++;
      }
    }

    // Process class methods
    for (const cls of file.classes) {
      for (const method of cls.methods) {
        try {
          const position = findSymbolPosition(
            absolutePath,
            method.name,
            cls.name,
          );
          if (!position) {
            skippedCount++;
            continue;
          }

          const items = await client.prepareCallHierarchy(absolutePath, position);
          if (items.length === 0) {
            skippedCount++;
            continue;
          }

          const outgoing = await client.getOutgoingCalls(items[0]!);
          if (outgoing.length > 0) {
            method.calledFunctions = outgoing.map(call => call.to.name);
            enhancedCount++;
          }
        } catch {
          skippedCount++;
        }
      }
    }
  }

  console.log(`[LSP] Call hierarchy: enhanced ${enhancedCount}, skipped ${skippedCount}`);
}

/**
 * Find the position of a symbol name in a source file.
 * Optionally scoped within a parent symbol (e.g., a method inside a class).
 */
function findSymbolPosition(
  filePath: string,
  symbolName: string,
  parentName?: string,
): { line: number; character: number } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // If we have a parent, try to find the symbol after the parent declaration
    let startLine = 0;
    if (parentName) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.includes(`class ${parentName}`) || lines[i]!.includes(`interface ${parentName}`)) {
          startLine = i;
          break;
        }
      }
    }

    // Search for the symbol name as a function/method declaration
    const patterns = [
      new RegExp(`\\b(?:async\\s+)?(?:function\\s+)?${escapeRegExp(symbolName)}\\s*[<(]`),
      new RegExp(`\\b${escapeRegExp(symbolName)}\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|\\w+)\\s*=>`),
      new RegExp(`\\b${escapeRegExp(symbolName)}\\s*\\(`),
    ];

    for (let i = startLine; i < lines.length; i++) {
      for (const pattern of patterns) {
        const match = pattern.exec(lines[i]!);
        if (match) {
          const charIndex = lines[i]!.indexOf(symbolName, match.index);
          return {
            line: i,
            character: charIndex >= 0 ? charIndex : match.index,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Escape special regex characters in a string. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
