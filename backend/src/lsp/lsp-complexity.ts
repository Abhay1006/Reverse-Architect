// ============================================================
//  Atlas-TS — LSP Complexity Estimator
//  Estimates cyclomatic complexity from source text within a
//  given line range, without needing ts-morph AST access.
//  Uses pattern matching on decision-point keywords.
// ============================================================

import * as fs from 'fs';

/**
 * Decision-point patterns that increase cyclomatic complexity.
 * Each match adds 1 to the complexity score (base = 1).
 */
const DECISION_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bfor\s*\(/g,
  /\bfor\s*\.\.\./g,        // for...of / for...in
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /\?\s*[^:?]/g,             // Ternary operator (simple heuristic)
  /&&/g,                      // Logical AND
  /\|\|/g,                    // Logical OR
  /\?\?/g,                    // Nullish coalescing
];

/**
 * Estimate cyclomatic complexity for a code block defined by line range.
 * 
 * @param filePath Absolute path to the source file.
 * @param startLine 0-indexed start line.
 * @param endLine 0-indexed end line (inclusive).
 * @returns Estimated cyclomatic complexity (minimum 1).
 */
export function estimateComplexity(
  filePath: string,
  startLine: number,
  endLine: number,
): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const slice = lines.slice(startLine, endLine + 1).join('\n');
    return estimateComplexityFromText(slice);
  } catch {
    return 1;
  }
}

/**
 * Estimate cyclomatic complexity from a raw code string.
 * 
 * @param code The source code text.
 * @returns Estimated cyclomatic complexity (minimum 1).
 */
export function estimateComplexityFromText(code: string): number {
  // Strip string literals and comments to avoid false positives
  const cleaned = code
    .replace(/\/\/.*$/gm, '')                // Single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')        // Multi-line comments
    .replace(/"(?:\\.|[^"\\])*"/g, '""')     // Double-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, "''")     // Single-quoted strings
    .replace(/`(?:\\.|[^`\\])*`/g, '``');    // Template literals

  let complexity = 1; // Base complexity

  for (const pattern of DECISION_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const matches = cleaned.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}
