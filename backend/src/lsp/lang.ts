// ============================================================
//  Atlas — Source Language Detection
//  Kept dependency-free so both the import parser (lsp-adapter)
//  and the text analyzer can use it without a circular import.
// ============================================================

import * as path from 'path';

export type Lang = 'ts' | 'js' | 'py' | 'go' | 'java' | 'rs' | 'c' | 'cs' | 'rb' | 'php' | 'kt' | 'swift' | 'scala' | 'dart' | 'lua' | 'elixir' | 'unknown';

const EXTENSION_LANG: Record<string, Lang> = {
  '.ts': 'ts', '.tsx': 'ts', '.mts': 'ts', '.cts': 'ts',
  '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
  '.py': 'py', '.pyw': 'py', '.go': 'go', '.java': 'java', '.rs': 'rs',
  '.c': 'c', '.h': 'c', '.cpp': 'c', '.hpp': 'c', '.cc': 'c', '.cxx': 'c',
  '.cs': 'cs', '.rb': 'rb', '.php': 'php', '.kt': 'kt', '.kts': 'kt',
  '.swift': 'swift', '.scala': 'scala', '.dart': 'dart', '.lua': 'lua',
  '.ex': 'elixir', '.exs': 'elixir',
};

/** Language for a file extension (including the leading dot). */
export function detectLang(ext: string): Lang {
  return EXTENSION_LANG[ext] ?? 'unknown';
}

/** Language for a file path. */
export function detectLangFromPath(filePath: string): Lang {
  return detectLang(path.extname(filePath));
}

export function isJsTsLang(lang: Lang): boolean {
  return lang === 'ts' || lang === 'js';
}
