// ============================================================
//  Atlas — Generic Text-Based Analyzer
//  Extracts symbols, imports, and calls from ANY language
//  using regex patterns. No LSP server needed.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { parseImportsFromText, extractCalledFunctionsFromText } from './lsp-adapter.js';
import { estimateComplexityFromText } from './lsp-complexity.js';
import type { ParsedFile, ParsedClass, ParsedInterface, ParsedFunction, ParsedImport } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
//  Language Detection
// ---------------------------------------------------------------------------

export type Lang = 'ts' | 'js' | 'py' | 'go' | 'java' | 'rs' | 'c' | 'cs' | 'rb' | 'php' | 'kt' | 'swift' | 'scala' | 'dart' | 'lua' | 'elixir' | 'unknown';

export function detectLang(ext: string): Lang {
  const map: Record<string, Lang> = {
    '.ts': 'ts', '.tsx': 'ts', '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
    '.py': 'py', '.pyw': 'py', '.go': 'go', '.java': 'java', '.rs': 'rs',
    '.c': 'c', '.h': 'c', '.cpp': 'c', '.hpp': 'c', '.cc': 'c', '.cxx': 'c',
    '.cs': 'cs', '.rb': 'rb', '.php': 'php', '.kt': 'kt', '.kts': 'kt',
    '.swift': 'swift', '.scala': 'scala', '.dart': 'dart', '.lua': 'lua',
    '.ex': 'elixir', '.exs': 'elixir',
  };
  return map[ext] || 'unknown';
}

export function isJsTsLang(lang: Lang): boolean {
  return lang === 'ts' || lang === 'js';
}

// ---------------------------------------------------------------------------
//  Detect project primary language
// ---------------------------------------------------------------------------

export function detectProjectLanguage(filePaths: string[]): Lang {
  const counts = new Map<Lang, number>();
  for (const fp of filePaths) {
    const lang = detectLang(path.extname(fp));
    if (lang !== 'unknown') counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  let best: Lang = 'unknown';
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) { best = lang; bestCount = count; }
  }
  return best;
}

// ---------------------------------------------------------------------------
//  Generic Text-Based File Analysis
// ---------------------------------------------------------------------------

export function analyzeFileWithText(filePath: string): ParsedFile {
  const ext = path.extname(filePath);
  const lang = detectLang(ext);
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { content = ''; }

  const lines = content.split('\n');
  const imports = parseImportsFromText(content);
  const classes = extractClasses(content, lang, filePath);
  const interfaces = extractInterfaces(content, lang);
  const functions = extractFunctions(content, lang, filePath);

  return {
    kind: 'file',
    name: path.basename(filePath),
    filePath,
    imports,
    classes,
    interfaces,
    functions,
    lineCount: lines.length,
  };
}

// ---------------------------------------------------------------------------
//  Multi-Language Class/Struct Extraction
// ---------------------------------------------------------------------------

function extractClasses(content: string, lang: Lang, filePath: string): ParsedClass[] {
  const classes: ParsedClass[] = [];
  const lines = content.split('\n');

  const patterns: RegExp[] = [];
  switch (lang) {
    case 'go':
      patterns.push(/^type\s+(\w+)\s+struct\s*\{/gm);
      break;
    case 'py':
      patterns.push(/^class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm);
      break;
    case 'java': case 'kt': case 'scala': case 'dart':
      patterns.push(/(?:public|private|protected|abstract|open|data|sealed)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/gm);
      break;
    case 'rs':
      patterns.push(/^(?:pub\s+)?struct\s+(\w+)/gm);
      break;
    case 'cs':
      patterns.push(/(?:public|private|protected|internal|abstract|sealed)?\s*class\s+(\w+)(?:\s*:\s*([\w,\s]+))?/gm);
      break;
    case 'rb':
      patterns.push(/^class\s+(\w+)(?:\s*<\s*(\w+))?/gm);
      break;
    case 'php':
      patterns.push(/(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s\\]+))?/gm);
      break;
    case 'swift':
      patterns.push(/(?:public|private|internal|open|final)?\s*class\s+(\w+)(?:\s*:\s*([\w,\s]+))?/gm);
      break;
    case 'c':
      patterns.push(/^(?:typedef\s+)?struct\s+(\w+)\s*\{/gm);
      break;
    case 'ts': case 'js':
      patterns.push(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/gm);
      break;
    default:
      patterns.push(/class\s+(\w+)/gm);
  }

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(content)) !== null) {
      const name = m[1]!;
      const extendsName = m[2]?.trim();
      const implStr = m[3] || '';
      const implementsList = implStr ? implStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const startLine = content.substring(0, m.index).split('\n').length - 1;
      const endLine = findBlockEnd(lines, startLine, lang);
      const block = lines.slice(startLine, endLine + 1).join('\n');
      const methods = extractMethodsFromBlock(block, lang, filePath, startLine);

      classes.push({
        kind: 'class',
        name,
        isExported: /(?:export|pub|public)\b/.test(m[0]),
        isAbstract: /abstract/.test(m[0]),
        properties: [],
        methods,
        extends: extendsName,
        implements: implementsList,
        decorators: [],
        lineCount: endLine - startLine + 1,
      });
    }
  }
  return classes;
}

// ---------------------------------------------------------------------------
//  Multi-Language Interface/Trait Extraction
// ---------------------------------------------------------------------------

function extractInterfaces(content: string, lang: Lang): ParsedInterface[] {
  const interfaces: ParsedInterface[] = [];
  const lines = content.split('\n');
  const patterns: RegExp[] = [];

  switch (lang) {
    case 'go':
      patterns.push(/^type\s+(\w+)\s+interface\s*\{/gm);
      break;
    case 'ts': case 'js':
      patterns.push(/(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{/gm);
      break;
    case 'rs':
      patterns.push(/^(?:pub\s+)?trait\s+(\w+)/gm);
      break;
    case 'java': case 'kt':
      patterns.push(/(?:public\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{/gm);
      break;
    case 'cs':
      patterns.push(/(?:public\s+)?interface\s+(I\w+)(?:\s*:\s*([\w,\s]+))?\s*\{/gm);
      break;
    case 'swift':
      patterns.push(/protocol\s+(\w+)(?:\s*:\s*([\w,\s]+))?\s*\{/gm);
      break;
    case 'php':
      patterns.push(/interface\s+(\w+)(?:\s+extends\s+([\w,\s\\]+))?\s*\{/gm);
      break;
    case 'dart':
      patterns.push(/abstract\s+class\s+(\w+)/gm);
      break;
    default: break;
  }

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(content)) !== null) {
      const name = m[1]!;
      const extStr = m[2] || '';
      const extList = extStr ? extStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const startLine = content.substring(0, m.index).split('\n').length - 1;
      const endLine = findBlockEnd(lines, startLine, lang);

      interfaces.push({
        kind: 'interface',
        name,
        isExported: /(?:export|pub|public)\b/.test(m[0]),
        properties: [],
        methods: [],
        extends: extList,
        lineCount: endLine - startLine + 1,
      });
    }
  }
  return interfaces;
}

// ---------------------------------------------------------------------------
//  Multi-Language Function Extraction
// ---------------------------------------------------------------------------

function extractFunctions(content: string, lang: Lang, filePath: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const lines = content.split('\n');
  const patterns: RegExp[] = [];

  switch (lang) {
    case 'go':
      // Top-level functions only (no receiver)
      patterns.push(/^func\s+(\w+)\s*\(/gm);
      break;
    case 'py':
      patterns.push(/^def\s+(\w+)\s*\(/gm);
      break;
    case 'java': case 'kt': case 'scala': case 'dart':
      patterns.push(/(?:public|private|protected|static|final|override|suspend)?\s*(?:fun|void|int|String|boolean|long|double|float|[\w<>\[\]]+)\s+(\w+)\s*\(/gm);
      break;
    case 'rs':
      patterns.push(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm);
      break;
    case 'c':
      patterns.push(/^(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:unsigned\s+)?(?:void|int|char|float|double|long|bool|size_t|[\w*]+)\s+(\w+)\s*\(/gm);
      break;
    case 'cs':
      patterns.push(/(?:public|private|protected|internal|static|async|override|virtual)?\s*(?:void|int|string|bool|Task|[\w<>\[\]]+)\s+(\w+)\s*\(/gm);
      break;
    case 'rb':
      patterns.push(/^(?:\s*)def\s+(\w+[?!]?)/gm);
      break;
    case 'php':
      patterns.push(/(?:public|private|protected|static)?\s*function\s+(\w+)\s*\(/gm);
      break;
    case 'swift':
      patterns.push(/(?:public|private|internal|open|override|static|class)?\s*func\s+(\w+)\s*\(/gm);
      break;
    case 'lua':
      patterns.push(/(?:local\s+)?function\s+(\w+(?:\.\w+)*)\s*\(/gm);
      break;
    case 'elixir':
      patterns.push(/\bdef[p]?\s+(\w+)/gm);
      break;
    case 'ts': case 'js':
      patterns.push(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm);
      patterns.push(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/gm);
      break;
    default:
      patterns.push(/function\s+(\w+)\s*\(/gm);
  }

  // Filter out names that are inside classes (we handle those as methods)
  const classMethodNames = new Set<string>();

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(content)) !== null) {
      const name = m[1]!;
      if (name === 'main' && lang === 'c') continue; // Skip C main
      if (/^[A-Z_]+$/.test(name)) continue; // Skip ALL_CAPS constants
      
      const startLine = content.substring(0, m.index).split('\n').length - 1;
      const endLine = findBlockEnd(lines, startLine, lang);
      const block = lines.slice(startLine, endLine + 1).join('\n');
      const complexity = estimateComplexityFromText(block);
      const calledFunctions = extractCalledFunctionsFromText(block);

      functions.push({
        kind: 'function',
        name,
        isExported: /(?:export|pub|public)\b/.test(m[0]) || (lang === 'go' && /^[A-Z]/.test(name)),
        parameters: [],
        returnType: 'void',
        lineCount: endLine - startLine + 1,
        complexity,
        calledFunctions,
      });
    }
  }
  return functions;
}

// ---------------------------------------------------------------------------
//  Method Extraction (inside class/struct blocks)
// ---------------------------------------------------------------------------

function extractMethodsFromBlock(block: string, lang: Lang, filePath: string, blockStart: number) {
  const methods: { name: string; parameters: any[]; returnType: string; visibility: 'public' | 'protected' | 'private' | 'unknown'; complexity: number; calledFunctions: string[] }[] = [];
  const patterns: RegExp[] = [];

  switch (lang) {
    case 'go':
      // Go methods are outside the struct, but we look for func with receiver
      break;
    case 'py':
      patterns.push(/^\s+def\s+(\w+)\s*\(/gm);
      break;
    case 'java': case 'kt': case 'dart': case 'scala':
      patterns.push(/\s+(?:public|private|protected|static|final|override|abstract|suspend)?\s*(?:fun|void|int|String|boolean|[\w<>\[\]]+)\s+(\w+)\s*\(/gm);
      break;
    case 'cs':
      patterns.push(/\s+(?:public|private|protected|internal|static|async|override|virtual|abstract)?\s*(?:void|int|string|bool|Task|[\w<>\[\]]+)\s+(\w+)\s*\(/gm);
      break;
    case 'rb':
      patterns.push(/^\s+def\s+(\w+[?!]?)/gm);
      break;
    case 'php':
      patterns.push(/\s+(?:public|private|protected|static)?\s*function\s+(\w+)\s*\(/gm);
      break;
    case 'swift':
      patterns.push(/\s+(?:public|private|internal|open|override|static|class|mutating)?\s*func\s+(\w+)\s*\(/gm);
      break;
    case 'rs':
      patterns.push(/\s+(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm);
      break;
    case 'ts': case 'js':
      patterns.push(/\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm);
      break;
    default:
      break;
  }

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(block)) !== null) {
      const name = m[1]!;
      if (['if', 'for', 'while', 'switch', 'catch', 'constructor', 'class', 'function', 'return'].includes(name)) continue;
      const bodyStart = block.indexOf('\n', m.index);
      const bodySnippet = block.substring(m.index, Math.min(block.length, m.index + 500));
      methods.push({
        name,
        parameters: [],
        returnType: 'void',
        visibility: /private/.test(m[0]) ? 'private' : /protected/.test(m[0]) ? 'protected' : 'public',
        complexity: estimateComplexityFromText(bodySnippet),
        calledFunctions: extractCalledFunctionsFromText(bodySnippet),
      });
    }
  }
  return methods;
}

// ---------------------------------------------------------------------------
//  Go-Specific: Method Extraction (receiver functions)
// ---------------------------------------------------------------------------

export function extractGoMethods(content: string, filePath: string): Map<string, ParsedFunction[]> {
  const methodMap = new Map<string, ParsedFunction[]>();
  const lines = content.split('\n');
  // func (r *Router) Get(path string, handler Handler) { ... }
  const pat = /^func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+(\w+)\s*\(/gm;
  let m;
  while ((m = pat.exec(content)) !== null) {
    const receiver = m[1]!;
    const name = m[2]!;
    const startLine = content.substring(0, m.index).split('\n').length - 1;
    const endLine = findBlockEnd(lines, startLine, 'go');
    const block = lines.slice(startLine, endLine + 1).join('\n');

    if (!methodMap.has(receiver)) methodMap.set(receiver, []);
    methodMap.get(receiver)!.push({
      kind: 'function',
      name,
      isExported: /^[A-Z]/.test(name),
      parameters: [],
      returnType: 'void',
      lineCount: endLine - startLine + 1,
      complexity: estimateComplexityFromText(block),
      calledFunctions: extractCalledFunctionsFromText(block),
    });
  }
  return methodMap;
}

// ---------------------------------------------------------------------------
//  Go Module Import Resolution
// ---------------------------------------------------------------------------

export function resolveGoImports(
  projectPath: string,
  filePaths: string[],
): { moduleName: string; dirMap: Map<string, string[]> } {
  let moduleName = '';
  try {
    const goMod = fs.readFileSync(path.join(projectPath, 'go.mod'), 'utf-8');
    const modMatch = goMod.match(/^module\s+(\S+)/m);
    if (modMatch) moduleName = modMatch[1]!;
  } catch { /* no go.mod */ }

  // Build a map: relative dir path → list of .go files in that dir
  const dirMap = new Map<string, string[]>();
  for (const fp of filePaths) {
    if (!fp.endsWith('.go')) continue;
    const rel = path.relative(projectPath, fp).split(path.sep).join('/');
    const dir = path.dirname(rel);
    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push(rel);
  }

  return { moduleName, dirMap };
}

// ---------------------------------------------------------------------------
//  Generic Import Resolution for Non-JS Languages
// ---------------------------------------------------------------------------

export function resolveGenericImport(
  imp: ParsedImport,
  filePath: string,
  projectPath: string,
  allFilePaths: Set<string>,
  goInfo?: { moduleName: string; dirMap: Map<string, string[]> },
): string | undefined {
  const spec = imp.moduleSpecifier;

  // Relative imports (./something or ../something)
  if (spec.startsWith('.')) {
    const dir = path.dirname(filePath);
    const resolved = path.resolve(projectPath, dir, spec);
    const relResolved = path.relative(projectPath, resolved).split(path.sep).join('/');
    if (allFilePaths.has(relResolved)) return relResolved;
    // Try extensions
    for (const ext of ['.go', '.py', '.rs', '.java', '.kt', '.c', '.h', '.cpp', '.cs', '.rb', '.php', '.swift', '.scala', '.dart', '.ts', '.js', '.tsx', '.jsx']) {
      if (allFilePaths.has(relResolved + ext)) return relResolved + ext;
    }
    // Try index files
    for (const idx of ['/index.ts', '/index.js', '/index.tsx', '/index.jsx', '/__init__.py', '/mod.rs', '/lib.rs']) {
      if (allFilePaths.has(relResolved + idx)) return relResolved + idx;
    }
    return undefined;
  }

  // Go module imports
  if (goInfo && goInfo.moduleName && spec.startsWith(goInfo.moduleName)) {
    const pkgPath = spec.substring(goInfo.moduleName.length + 1); // strip module name + /
    const goFiles = goInfo.dirMap.get(pkgPath);
    if (goFiles && goFiles.length > 0) {
      // Return the first Go file in the package (they all belong to same package)
      return goFiles[0]!;
    }
    return undefined;
  }

  // Python relative-style imports (converted from dots to slashes)
  // Try matching as a directory with __init__.py
  const pyInit = spec + '/__init__.py';
  if (allFilePaths.has(pyInit)) return pyInit;
  const pyFile = spec + '.py';
  if (allFilePaths.has(pyFile)) return pyFile;

  // Try direct match
  if (allFilePaths.has(spec)) return spec;

  return undefined;
}

// ---------------------------------------------------------------------------
//  Block End Finder (brace/indent-based)
// ---------------------------------------------------------------------------

function findBlockEnd(lines: string[], startLine: number, lang: Lang): number {
  // For indentation-based languages (Python, Ruby, Elixir)
  if (lang === 'py' || lang === 'elixir') {
    const startIndent = lines[startLine]?.search(/\S/) ?? 0;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === '') continue;
      const indent = line.search(/\S/);
      if (indent <= startIndent && line.trim() !== '') return i - 1;
    }
    return lines.length - 1;
  }

  // For brace-based languages
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!;
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') { depth--; }
    }
    if (foundOpen && depth <= 0) return i;
  }
  return Math.min(startLine + 20, lines.length - 1);
}
