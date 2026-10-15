// ============================================================
//  Atlas — LSP → ParsedFile Adapter
//  Converts LSP DocumentSymbol[] responses into the ParsedFile
//  format expected by the graph builder. This is the compatibility
//  bridge between the new LSP layer and the existing pipeline.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { SymbolKind, type DocumentSymbol } from './lsp-types.js';
import { estimateComplexity } from './lsp-complexity.js';
import { detectLangFromPath, type Lang } from './lang.js';
import type {
  ParsedFile,
  ParsedClass,
  ParsedInterface,
  ParsedFunction,
  ParsedMethod,
  ParsedProperty,
  ParsedParameter,
  ParsedImport,
} from 'shared';

// ---------------------------------------------------------------------------
//  Main Adapter Function
// ---------------------------------------------------------------------------

const fileContentCache = new Map<string, string[]>();

/** Clear the file content cache. Called at the start of a project analysis run. */
export function clearFileCache(): void {
  fileContentCache.clear();
}

/** Get the lines of a file, reading from disk only once per file. */
function getFileLines(filePath: string): string[] {
  let lines = fileContentCache.get(filePath);
  if (!lines) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      lines = content.split('\n');
      fileContentCache.set(filePath, lines);
    } catch {
      lines = [];
    }
  }
  return lines;
}

/**
 * Convert LSP document symbols for a single file into a ParsedFile.
 * 
 * @param filePath Absolute path to the source file.
 * @param symbols Hierarchical DocumentSymbol[] from the LSP server.
 * @param resolvedImports Pre-resolved import information for this file.
 * @returns A ParsedFile matching the existing shared type contract.
 */
export function adaptSymbolsToParsedFile(
  filePath: string,
  symbols: DocumentSymbol[],
  resolvedImports: ParsedImport[],
): ParsedFile {
  const classes: ParsedClass[] = [];
  const interfaces: ParsedInterface[] = [];
  const functions: ParsedFunction[] = [];

  for (const sym of symbols) {
    switch (sym.kind) {
      case SymbolKind.Class:
        classes.push(adaptClass(sym, filePath));
        break;

      case SymbolKind.Interface:
        interfaces.push(adaptInterface(sym, filePath));
        break;

      case SymbolKind.Function:
        functions.push(adaptFunction(sym, filePath));
        break;

      case SymbolKind.Variable:
      case SymbolKind.Constant:
        // Check if this variable is an arrow function by inspecting its children
        // or the detail string (which often shows the type signature)
        if (isLikelyArrowFunction(sym)) {
          functions.push(adaptFunction(sym, filePath));
        }
        break;

      case SymbolKind.Module:
      case SymbolKind.Namespace:
        // Recursively process symbols inside modules/namespaces
        if (sym.children) {
          const nested = adaptSymbolsToParsedFile(filePath, sym.children, []);
          classes.push(...nested.classes);
          interfaces.push(...nested.interfaces);
          functions.push(...nested.functions);
        }
        break;

      default:
        // Enum, TypeAlias, etc. — skip for now
        break;
    }
  }

  // Calculate total line count
  const lines = getFileLines(filePath);
  const lineCount = lines.length;

  return {
    kind: 'file',
    name: path.basename(filePath),
    filePath, // Will be made relative by the caller
    imports: resolvedImports,
    classes,
    interfaces,
    functions,
    lineCount,
  };
}

// ---------------------------------------------------------------------------
//  Class Adapter
// ---------------------------------------------------------------------------

function adaptClass(sym: DocumentSymbol, filePath: string): ParsedClass {
  const properties: ParsedProperty[] = [];
  const methods: ParsedMethod[] = [];
  let extendsName: string | undefined;
  const implementsList: string[] = [];
  const decorators: string[] = [];

  // Process children of the class
  if (sym.children) {
    for (const child of sym.children) {
      switch (child.kind) {
        case SymbolKind.Property:
        case SymbolKind.Field:
          properties.push(adaptProperty(child));
          break;

        case SymbolKind.Method:
        case SymbolKind.Constructor:
          methods.push(adaptMethod(child, filePath));
          break;

        default:
          break;
      }
    }
  }

  // Try to extract extends/implements from the detail string
  // typescript-language-server often puts this in the detail field
  if (sym.detail) {
    const extendsMatch = sym.detail.match(/extends\s+(\w+)/);
    if (extendsMatch) extendsName = extendsMatch[1];

    const implMatch = sym.detail.match(/implements\s+([\w,\s]+)/);
    if (implMatch) {
      implementsList.push(
        ...implMatch[1]!.split(',').map(s => s.trim()).filter(Boolean)
      );
    }
  }

  // If detail doesn't have extends/implements, try parsing the source line
  if (!extendsName) {
    const lineInfo = readSourceLine(filePath, sym.range.start.line);
    if (lineInfo) {
      const extMatch = lineInfo.match(/extends\s+(\w+)/);
      if (extMatch) extendsName = extMatch[1];

      if (implementsList.length === 0) {
        const implMatch = lineInfo.match(/implements\s+([\w,\s<>]+)/);
        if (implMatch) {
          implementsList.push(
            ...implMatch[1]!.split(',').map(s => s.trim().replace(/<.*>/, '')).filter(Boolean)
          );
        }
      }
    }
  }

  const lineCount = sym.range.end.line - sym.range.start.line + 1;

  // Check if exported by looking at the source line
  const isExported = checkIfExported(filePath, sym.range.start.line);
  const isAbstract = checkIfAbstract(filePath, sym.range.start.line);

  return {
    kind: 'class',
    name: sym.name,
    isExported,
    isAbstract,
    properties,
    methods,
    extends: extendsName,
    implements: implementsList,
    decorators,
    lineCount,
  };
}

// ---------------------------------------------------------------------------
//  Interface Adapter
// ---------------------------------------------------------------------------

function adaptInterface(sym: DocumentSymbol, filePath: string): ParsedInterface {
  const properties: ParsedProperty[] = [];
  const methods: ParsedMethod[] = [];
  const extendsList: string[] = [];

  if (sym.children) {
    for (const child of sym.children) {
      switch (child.kind) {
        case SymbolKind.Property:
        case SymbolKind.Field:
          properties.push(adaptProperty(child));
          break;

        case SymbolKind.Method:
          methods.push(adaptMethod(child, filePath));
          break;

        default:
          break;
      }
    }
  }

  // Extract extends from detail or source
  if (sym.detail) {
    const extMatch = sym.detail.match(/extends\s+([\w,\s<>]+)/);
    if (extMatch) {
      extendsList.push(
        ...extMatch[1]!.split(',').map(s => s.trim().replace(/<.*>/, '')).filter(Boolean)
      );
    }
  }

  if (extendsList.length === 0) {
    const lineInfo = readSourceLine(filePath, sym.range.start.line);
    if (lineInfo) {
      const extMatch = lineInfo.match(/extends\s+([\w,\s<>]+)\s*\{/);
      if (extMatch) {
        extendsList.push(
          ...extMatch[1]!.split(',').map(s => s.trim().replace(/<.*>/, '')).filter(Boolean)
        );
      }
    }
  }

  const lineCount = sym.range.end.line - sym.range.start.line + 1;
  const isExported = checkIfExported(filePath, sym.range.start.line);

  return {
    kind: 'interface',
    name: sym.name,
    isExported,
    properties,
    methods,
    extends: extendsList,
    lineCount,
  };
}

// ---------------------------------------------------------------------------
//  Function Adapter
// ---------------------------------------------------------------------------

function adaptFunction(sym: DocumentSymbol, filePath: string): ParsedFunction {
  const parameters = extractParametersFromDetail(sym.detail || '');
  const returnType = extractReturnTypeFromDetail(sym.detail || '');
  const lineCount = sym.range.end.line - sym.range.start.line + 1;
  const complexity = estimateComplexity(filePath, sym.range.start.line, sym.range.end.line);
  const isExported = checkIfExported(filePath, sym.range.start.line);

  // Extract called functions from the function body text
  const calledFunctions = extractCalledFunctionsFromSource(filePath, sym.range.start.line, sym.range.end.line).filter(f => f !== sym.name);

  return {
    kind: 'function',
    name: sym.name,
    isExported,
    parameters,
    returnType,
    lineCount,
    complexity,
    calledFunctions,
    namePosition: { ...sym.selectionRange.start },
  };
}

// ---------------------------------------------------------------------------
//  Property & Method Adapters
// ---------------------------------------------------------------------------

function adaptProperty(sym: DocumentSymbol): ParsedProperty {
  const visibility = extractVisibility(sym.name, sym.detail);

  return {
    name: sym.name,
    type: sym.detail || 'any',
    visibility,
  };
}

function adaptMethod(sym: DocumentSymbol, filePath: string): ParsedMethod {
  const visibility = extractVisibility(sym.name, sym.detail);
  const parameters = extractParametersFromDetail(sym.detail || '');
  const returnType = extractReturnTypeFromDetail(sym.detail || '');
  const complexity = estimateComplexity(filePath, sym.range.start.line, sym.range.end.line);
  const calledFunctions = extractCalledFunctionsFromSource(filePath, sym.range.start.line, sym.range.end.line).filter(f => f !== sym.name);

  return {
    name: sym.name,
    parameters,
    returnType,
    visibility,
    complexity,
    calledFunctions,
    namePosition: { ...sym.selectionRange.start },
  };
}

// ---------------------------------------------------------------------------
//  Import Extraction (from source text)
// ---------------------------------------------------------------------------

/**
 * Extract import declarations from a source file by parsing the text.
 * This is a fallback when we can't get imports from LSP directly.
 */
export function extractImportsFromSource(filePath: string): ParsedImport[] {
  try {
    const lines = getFileLines(filePath);
    return parseImportsFromText(lines.join('\n'), detectLangFromPath(filePath));
  } catch {
    return [];
  }
}

/** Which import syntaxes apply to each language. */
type ImportSyntax = 'es' | 'commonjs' | 'python' | 'go' | 'jvm' | 'c' | 'rust' | 'ruby' | 'php' | 'csharp' | 'swift' | 'lua';

const IMPORT_SYNTAX: Partial<Record<Lang, ImportSyntax[]>> = {
  ts: ['es', 'commonjs'],
  js: ['es', 'commonjs'],
  py: ['python'],
  go: ['go'],
  java: ['jvm'],
  kt: ['jvm'],
  scala: ['jvm'],
  c: ['c'],
  rs: ['rust'],
  rb: ['ruby'],
  php: ['php'],
  cs: ['csharp'],
  swift: ['swift'],
  dart: ['es'],
  lua: ['lua'],
};

const ALL_SYNTAXES: ImportSyntax[] = ['es', 'commonjs', 'python', 'go', 'jvm', 'c', 'rust', 'ruby', 'php', 'csharp', 'swift', 'lua'];

/**
 * Parse import statements from source text.
 *
 * Only the syntaxes of `lang` are applied. Running every language's patterns
 * over every file produced false matches — Go's `import "x"` pattern, for one,
 * re-recorded every JS side-effect import a second time. When `lang` is
 * omitted or unknown, all syntaxes are tried.
 */
export function parseImportsFromText(text: string, lang?: Lang): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const syntaxes = new Set<ImportSyntax>((lang && IMPORT_SYNTAX[lang]) || ALL_SYNTAXES);
  let match;

  if (syntaxes.has('es')) {
    // import { x, y } from 'module';  import Default from 'module';
    // import * as ns from 'module';    import 'module';  import type { x } from 'module';
    const importRegex = /\bimport\s+(?:type\s+)?(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?(?:\*\s+as\s+(\w+))?(?:\s+from\s+)?)?['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(text)) !== null) {
      imports.push({
        kind: 'import',
        moduleSpecifier: match[4]!,
        defaultImport: match[1] || undefined,
        namedImports: splitNamedImports(match[2] || ''),
        namespaceImport: match[3] || undefined,
      });
    }

    // Re-exports: export * from 'm';  export * as ns from 'm';  export { a, b as c } from 'm';
    // Without these, barrel (index) files had no outgoing edges and everything
    // behind them dropped out of the reachability walk.
    const reExportRegex = /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+(\w+))?|\{([^}]*)\})\s*from\s*['"]([^'"]+)['"]/g;
    while ((match = reExportRegex.exec(text)) !== null) {
      imports.push({
        kind: 'import',
        moduleSpecifier: match[3]!,
        namedImports: splitNamedImports(match[2] || ''),
        namespaceImport: match[1] || undefined,
        isReExport: true,
      });
    }

    // Dynamic imports: import('./lazy') / const { a, b } = await import("./lazy")
    const dynamicImportRegex = /(?:(?:const|let|var)\s*\{([^}]*)\}\s*=\s*)?(?:await\s+)?\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(text)) !== null) {
      // Destructuring renames with `:` rather than `as`.
      const namedImports = (match[1] || '').split(',').map(s => s.trim().split(/\s*:\s*/)[0]?.trim() || '').filter(Boolean);
      imports.push({ kind: 'import', moduleSpecifier: match[2]!, namedImports });
    }
  }

  if (syntaxes.has('commonjs')) {
    // const x = require('module');  const { a, b } = require('module')
    const requireRegex = /(?:const|let|var)\s+(?:(\w+)|(?:\{([^}]*)\}))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(text)) !== null) {
      const namedImports = (match[2] || '').split(',').map(s => s.trim().split(/\s*:\s*/)[0]?.trim() || '').filter(Boolean);
      imports.push({ kind: 'import', moduleSpecifier: match[3]!, defaultImport: match[1] || undefined, namedImports });
    }
  }

  if (syntaxes.has('python')) {
    // from module import x, y
    const pyFromRegex = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
    while ((match = pyFromRegex.exec(text)) !== null) {
      const namedImports = match[2]!.split(',').map(s => s.trim().split(/\s+as\s+/)[0]?.trim() || '').filter(Boolean);
      imports.push({ kind: 'import', moduleSpecifier: match[1]!.replace(/\./g, '/'), namedImports });
    }
    // import module
    const pyImportRegex = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/gm;
    while ((match = pyImportRegex.exec(text)) !== null) {
      const mod = match[1]!;
      imports.push({ kind: 'import', moduleSpecifier: mod.replace(/\./g, '/'), defaultImport: match[2] || mod.split('.').pop(), namedImports: [] });
    }
  }

  if (syntaxes.has('go')) {
    // import "package" / import alias "package" / lines inside an import ( ... ) block
    const goImportRegex = /import\s+(?:(\w+)\s+)?"([^"]+)"/g;
    while ((match = goImportRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[2]!, defaultImport: match[1], namedImports: [] });
    }
  }

  if (syntaxes.has('jvm')) {
    // Java: import com.example.ClassName;   Kotlin/Scala: same, semicolon optional
    const jvmImportRegex = /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;?\s*$/gm;
    while ((match = jvmImportRegex.exec(text)) !== null) {
      const parts = match[1]!.split('.');
      const name = parts.pop()!;
      imports.push({ kind: 'import', moduleSpecifier: parts.join('/'), namedImports: name === '*' ? [] : [name] });
    }
  }

  if (syntaxes.has('c')) {
    // #include "file.h" (project-local includes)
    const cIncludeRegex = /^\s*#include\s+"([^"]+)"/gm;
    while ((match = cIncludeRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: './' + match[1]!, namedImports: [] });
    }
  }

  if (syntaxes.has('rust')) {
    // use crate::module::item;
    const rustUseRegex = /^use\s+((?:crate|super|self)(?:::\w+)+)(?:::\{([^}]+)\})?/gm;
    while ((match = rustUseRegex.exec(text)) !== null) {
      const modPath = match[1]!.replace(/::/g, '/').replace(/^crate\//, './');
      const namedImports = match[2] ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [];
      imports.push({ kind: 'import', moduleSpecifier: modPath, namedImports });
    }
  }

  if (syntaxes.has('ruby')) {
    // require 'file' / require_relative 'file'
    const rubyRequireRegex = /require(?:_relative)?\s+['"]([^'"]+)['"]/g;
    while ((match = rubyRequireRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[1]!, namedImports: [] });
    }
  }

  if (syntaxes.has('php')) {
    // use Namespace\Class;
    const phpUseRegex = /^use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/gm;
    while ((match = phpUseRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[1]!.replace(/\\/g, '/'), defaultImport: match[2], namedImports: [] });
    }
  }

  if (syntaxes.has('csharp')) {
    // using Namespace.SubNamespace;
    const csUsingRegex = /^using\s+(?:static\s+)?([\w.]+)\s*;/gm;
    while ((match = csUsingRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[1]!.replace(/\./g, '/'), namedImports: [] });
    }
  }

  if (syntaxes.has('swift')) {
    // import Module
    const swiftImportRegex = /^import\s+(\w+)\s*$/gm;
    while ((match = swiftImportRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[1]!, namedImports: [] });
    }
  }

  if (syntaxes.has('lua')) {
    // require("module") / require "module"
    const luaRequireRegex = /\brequire\s*\(?\s*['"]([^'"]+)['"]/g;
    while ((match = luaRequireRegex.exec(text)) !== null) {
      imports.push({ kind: 'import', moduleSpecifier: match[1]!, namedImports: [] });
    }
  }

  return imports;
}

/** `a, b as c, type d` → ['a', 'b', 'd'] (the local alias is not what the target exports). */
function splitNamedImports(list: string): string[] {
  return list
    .split(',')
    .map(s => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim() || '')
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Read a specific line from a file (0-indexed). */
function readSourceLine(filePath: string, lineNumber: number): string | null {
  try {
    const lines = getFileLines(filePath);
    // Also check a few lines above for decorators, and the line itself
    // might wrap, so grab a range
    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(lines.length, lineNumber + 3);
    return lines.slice(start, end).join(' ');
  } catch {
    return null;
  }
}

/** Check if a declaration at a given line is exported. */
function checkIfExported(filePath: string, lineNumber: number): boolean {
  try {
    const lines = getFileLines(filePath);
    // Check the declaration line and the line above (for `export` on previous line)
    const start = Math.max(0, lineNumber - 1);
    const end = Math.min(lines.length, lineNumber + 1);
    const snippet = lines.slice(start, end).join(' ');
    return /\bexport\b/.test(snippet);
  } catch {
    return false;
  }
}

/** Check if a class declaration is abstract. */
function checkIfAbstract(filePath: string, lineNumber: number): boolean {
  try {
    const lines = getFileLines(filePath);
    const line = lines[lineNumber] || '';
    return /\babstract\s+class\b/.test(line);
  } catch {
    return false;
  }
}

/** Determine the visibility of a member from its name prefix or detail. */
function extractVisibility(name: string, detail?: string): 'public' | 'protected' | 'private' | 'unknown' {
  // TypeScript convention: #privateProp or private keyword
  if (name.startsWith('#')) return 'private';

  // Check if the detail mentions visibility
  if (detail) {
    if (/\bprivate\b/.test(detail)) return 'private';
    if (/\bprotected\b/.test(detail)) return 'protected';
    if (/\bpublic\b/.test(detail)) return 'public';
  }

  return 'public'; // TypeScript default
}

/** Extract parameter list from a function detail string like "(a: string, b: number): void" */
function extractParametersFromDetail(detail: string): ParsedParameter[] {
  // Match the parameter list: (param1: type1, param2: type2)
  const paramMatch = detail.match(/\(([^)]*)\)/);
  if (!paramMatch || !paramMatch[1]) return [];

  return paramMatch[1]
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const [name, ...typeParts] = p.split(':');
      return {
        name: (name || '').trim().replace(/\?$/, ''),
        type: typeParts.join(':').trim() || 'any',
      };
    })
    .filter(p => p.name); // Filter out empty names
}

/** Extract return type from a function detail string. */
function extractReturnTypeFromDetail(detail: string): string {
  // Match after the closing parenthesis: ): ReturnType
  const returnMatch = detail.match(/\)\s*:\s*(.+)$/);
  if (returnMatch) return returnMatch[1]!.trim();

  // Match a simple type annotation: : Type
  const simpleMatch = detail.match(/:\s*(.+)$/);
  if (simpleMatch) return simpleMatch[1]!.trim();

  return 'void';
}

/** Check if a variable symbol is likely an arrow function. */
function isLikelyArrowFunction(sym: DocumentSymbol): boolean {
  // Heuristic 1: has children that are methods/functions
  if (sym.children && sym.children.some(c =>
    c.kind === SymbolKind.Function || c.kind === SymbolKind.Method
  )) {
    return false; // More likely an object
  }

  // Heuristic 2: detail contains function signature patterns
  if (sym.detail) {
    if (sym.detail.includes('=>') || sym.detail.includes('(')) {
      return true;
    }
  }

  // Heuristic 3: spans multiple lines (likely a function body)
  const lineSpan = sym.range.end.line - sym.range.start.line;
  if (lineSpan > 1 && sym.children && sym.children.length === 0) {
    return true; // Multi-line variable with no children — likely arrow fn
  }

  return false;
}

/**
 * Extract function calls from source text within a line range.
 * Simple pattern-based extraction (similar to old ts-morph approach
 * but from raw text).
 */
function extractCalledFunctionsFromSource(
  filePath: string,
  startLine: number,
  endLine: number,
): string[] {
  try {
    const lines = getFileLines(filePath);
    const slice = lines.slice(startLine, endLine + 1).join('\n');
    return extractCalledFunctionsFromText(slice);
  } catch {
    return [];
  }
}

/**
 * Extract function call names from source text.
 */
export function extractCalledFunctionsFromText(text: string): string[] {
  const calledFunctions = new Set<string>();

  // Strip comments and strings
  const cleaned = text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

  // Match function calls: identifier( or obj.method(
  const callPattern = /(?:^|[^.\w])(\w+)\s*\(/g;
  let match;
  while ((match = callPattern.exec(cleaned)) !== null) {
    const name = match[1]!;
    // Filter out language keywords
    if (!KEYWORDS.has(name)) {
      calledFunctions.add(name);
    }
  }

  // Match property access calls: something.method(
  const propCallPattern = /\.(\w+)\s*\(/g;
  while ((match = propCallPattern.exec(cleaned)) !== null) {
    const name = match[1]!;
    if (!KEYWORDS.has(name)) {
      calledFunctions.add(name);
    }
  }

  // JSX component usage: <Navbar /> renders Navbar, which is a reference just
  // like Navbar(). Without this every React component looked unused. The `<`
  // must follow an expression boundary (or `return`), which keeps generic type
  // arguments such as useState<Props>() and List<Foo> from matching.
  const jsxPattern = /(?:^|[(>{}?:=,;&|]|\breturn)\s*<([A-Z]\w*)(?=[\s/>])/gm;
  while ((match = jsxPattern.exec(cleaned)) !== null) {
    calledFunctions.add(match[1]!);
  }

  return Array.from(calledFunctions);
}

/** Keywords to exclude from function call detection. */
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'return', 'throw', 'try', 'catch', 'finally', 'new',
  'delete', 'typeof', 'instanceof', 'void', 'import', 'export',
  'const', 'let', 'var', 'class', 'function', 'async', 'await',
  'yield', 'from', 'as', 'of', 'in', 'type', 'interface', 'enum',
  'extends', 'implements', 'super', 'this', 'constructor',
]);
