// ============================================================
//  Atlas — Analysis Orchestrator
//  Routes projects to the right analyzer:
//    - JS/TS → LSP-powered analysis (TypeScript Language Server)
//    - All other languages → Generic text-based analysis
// ============================================================

import * as path from 'path';
import * as fs from 'fs';
import { LspClient, type LspClientOptions } from './lsp-client.js';
import { adaptSymbolsToParsedFile, extractImportsFromSource } from './lsp-adapter.js';
import { uriToPath, pathToUri } from './lsp-types.js';
import {
  detectProjectLanguage,
  isJsTsLang,
  detectLang,
  analyzeFileWithText,
  resolveGoImports,
  resolveGenericImport,
  extractGoMethods,
} from './text-analyzer.js';
import { importCandidatePaths } from '../graph/import-candidates.js';
import type { ParsedFile, ParsedImport } from 'shared';

// ---------------------------------------------------------------------------
//  Main Extraction Function
// ---------------------------------------------------------------------------

/**
 * Analyze a project — auto-detects language and chooses the right engine.
 */
export async function analyzeWithLsp(
  projectPath: string,
  opts?: LspClientOptions,
): Promise<ParsedFile[]> {
  // Discover all files first
  const client = new LspClient({ verbose: false, ...opts });
  const filePaths = client.discoverFiles(projectPath);
  console.log(`[Atlas] Discovered ${filePaths.length} source files`);

  if (filePaths.length === 0) return [];

  const MAX_FILES = 3000;
  if (filePaths.length > MAX_FILES) {
    throw new Error(`Repository is too large to analyze (${filePaths.length} source files discovered). The maximum limit is ${MAX_FILES} files. Please select a smaller repository or project.`);
  }

  const primaryLang = detectProjectLanguage(filePaths);
  console.log(`[Atlas] Primary language detected: ${primaryLang}`);

  // Decide analysis strategy
  const hasJsTs = filePaths.some(fp => isJsTsLang(detectLang(path.extname(fp))));
  const hasOther = filePaths.some(fp => !isJsTsLang(detectLang(path.extname(fp))) && detectLang(path.extname(fp)) !== 'unknown');

  // If primarily JS/TS, use LSP for those files + text for others
  if (isJsTsLang(primaryLang) && hasJsTs) {
    return analyzeWithLspEngine(projectPath, filePaths, opts);
  }

  // Otherwise use pure text-based analysis
  return analyzeWithTextEngine(projectPath, filePaths);
}

// ---------------------------------------------------------------------------
//  LSP Engine (JS/TS projects)
// ---------------------------------------------------------------------------

async function analyzeWithLspEngine(
  projectPath: string,
  allFilePaths: string[],
  opts?: LspClientOptions,
): Promise<ParsedFile[]> {
  const client = new LspClient({ verbose: false, ...opts });

  try {
    console.log(`[LSP] Opening project: ${projectPath}`);
    const filePaths = await client.openProject(projectPath);
    console.log(`[LSP] Project opened with ${filePaths.length} files`);

    const parsedFiles: ParsedFile[] = [];
    const filePathSet = new Set(filePaths);

    const relativePathMap = new Map<string, string>();
    for (const fp of filePaths) {
      relativePathMap.set(fp, path.relative(projectPath, fp).split(path.sep).join('/'));
    }

    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath);
        const lang = detectLang(ext);

        let parsed: ParsedFile;
        if (isJsTsLang(lang)) {
          // Use LSP for JS/TS
          const symbols = await client.getDocumentSymbols(filePath);
          const imports = await resolveJsImports(filePath, projectPath, filePathSet, client);
          parsed = adaptSymbolsToParsedFile(filePath, symbols, imports);
        } else {
          // Text-based for non-JS/TS files in mixed projects
          parsed = analyzeFileWithText(filePath);
        }

        parsed.filePath = relativePathMap.get(filePath) || parsed.filePath;

        for (const imp of parsed.imports) {
          if (imp.resolvedPath) {
            const abs = imp.resolvedPath;
            imp.resolvedPath = relativePathMap.has(abs)
              ? relativePathMap.get(abs)
              : path.relative(projectPath, abs).split(path.sep).join('/');
          }
        }

        parsedFiles.push(parsed);
      } catch (err) {
        console.error(`[LSP] Failed to process ${filePath}:`, err);
      }
    }

    console.log(`[LSP] Successfully parsed ${parsedFiles.length} files`);
    await enhanceWithCallHierarchy(client, parsedFiles, projectPath);
    return parsedFiles;
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
//  Text Engine (Go, Python, Rust, Java, etc.)
// ---------------------------------------------------------------------------

async function analyzeWithTextEngine(
  projectPath: string,
  filePaths: string[],
): Promise<ParsedFile[]> {
  console.log(`[Text] Analyzing ${filePaths.length} files with text engine`);

  const parsedFiles: ParsedFile[] = [];
  const relativePathMap = new Map<string, string>();
  const relativePathSet = new Set<string>();

  for (const fp of filePaths) {
    const rel = path.relative(projectPath, fp).split(path.sep).join('/');
    relativePathMap.set(fp, rel);
    relativePathSet.add(rel);
  }

  // Go-specific: resolve module imports
  const goInfo = resolveGoImports(projectPath, filePaths);
  if (goInfo.moduleName) {
    console.log(`[Text] Go module detected: ${goInfo.moduleName}`);
  }

  // Collect all Go methods (they're defined outside structs in Go)
  const allGoMethods = new Map<string, any[]>();
  const primaryLang = detectProjectLanguage(filePaths);
  if (primaryLang === 'go') {
    for (const fp of filePaths) {
      if (!fp.endsWith('.go')) continue;
      try {
        const content = fs.readFileSync(fp, 'utf-8');
        const methods = extractGoMethods(content, fp);
        for (const [receiver, fns] of methods) {
          if (!allGoMethods.has(receiver)) allGoMethods.set(receiver, []);
          allGoMethods.get(receiver)!.push(...fns);
        }
      } catch { /* skip */ }
    }
  }

  for (const filePath of filePaths) {
    try {
      const parsed = analyzeFileWithText(filePath);
      const relPath = relativePathMap.get(filePath) || parsed.filePath;
      parsed.filePath = relPath;

      // Resolve imports
      for (const imp of parsed.imports) {
        const resolved = resolveGenericImport(
          imp, relPath, projectPath, relativePathSet, goInfo
        );
        if (resolved) {
          imp.resolvedPath = resolved;
        }
      }

      // For Go: attach methods to their struct classes
      if (primaryLang === 'go') {
        for (const cls of parsed.classes) {
          const methods = allGoMethods.get(cls.name);
          if (methods) {
            cls.methods = methods.map(m => ({
              name: m.name,
              parameters: [],
              returnType: 'void',
              visibility: /^[A-Z]/.test(m.name) ? 'public' as const : 'private' as const,
              complexity: m.complexity || 1,
              calledFunctions: m.calledFunctions || [],
            }));
          }
        }
      }

      parsedFiles.push(parsed);
    } catch (err) {
      console.error(`[Text] Failed to process ${filePath}:`, err);
    }
  }

  console.log(`[Text] Successfully parsed ${parsedFiles.length} files`);
  return parsedFiles;
}

// ---------------------------------------------------------------------------
//  JS/TS Import Resolution
// ---------------------------------------------------------------------------

async function resolveJsImports(
  filePath: string,
  projectPath: string,
  allFilePaths: Set<string>,
  client: LspClient,
): Promise<ParsedImport[]> {
  const rawImports = extractImportsFromSource(filePath);

  for (const imp of rawImports) {
    if (!imp.moduleSpecifier.startsWith('.')) continue;
    const resolvedPath = resolveJsImportTarget(filePath, imp.moduleSpecifier, allFilePaths);
    if (resolvedPath) imp.resolvedPath = resolvedPath;
  }

  return rawImports;
}

function resolveJsImportTarget(
  importingFile: string,
  moduleSpecifier: string,
  knownFiles: Set<string>,
): string | undefined {
  const importDir = path.dirname(importingFile);
  const resolved = path.resolve(importDir, moduleSpecifier);
  const normalized = resolved.split(path.sep).join('/');

  for (const candidate of importCandidatePaths(normalized)) {
    if (knownFiles.has(candidate)) return candidate;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
//  Call Hierarchy Enhancement (LSP-only, JS/TS)
// ---------------------------------------------------------------------------

async function enhanceWithCallHierarchy(
  client: LspClient,
  parsedFiles: ParsedFile[],
  projectPath: string,
): Promise<void> {
  console.log('[LSP] Enhancing with call hierarchy data...');

  let enhancedCount = 0;
  let skippedCount = 0;

  // The language server already told us where each symbol's name is
  // (DocumentSymbol.selectionRange). Re-finding it by regex picked up call
  // sites and same-named functions instead of the declaration.
  const enhance = async (
    absolutePath: string,
    symbol: { namePosition?: { line: number; character: number }; calledFunctions?: string[] },
  ): Promise<void> => {
    if (!symbol.namePosition) { skippedCount++; return; }
    try {
      const items = await client.prepareCallHierarchy(absolutePath, symbol.namePosition);
      if (items.length === 0) { skippedCount++; return; }
      const outgoing = await client.getOutgoingCalls(items[0]!);
      if (outgoing.length > 0) {
        symbol.calledFunctions = outgoing.map(call => call.to.name);
        enhancedCount++;
      }
    } catch { skippedCount++; }
  };

  for (const file of parsedFiles) {
    const absolutePath = path.resolve(projectPath, file.filePath);
    if (!isJsTsLang(detectLang(path.extname(absolutePath)))) continue; // Skip non-JS/TS

    for (const fn of file.functions) await enhance(absolutePath, fn);
    for (const cls of file.classes) {
      for (const method of cls.methods) await enhance(absolutePath, method);
    }
  }

  console.log(`[LSP] Call hierarchy: enhanced ${enhancedCount}, skipped ${skippedCount}`);
}
