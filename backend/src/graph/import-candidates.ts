// ============================================================
//  Atlas — Import Target Candidates
//  Turns a module specifier that has been resolved to a base path
//  into the list of concrete files it might refer to.
//
//  The important case is TypeScript's ESM/NodeNext convention, where
//  source files import each other with a `.js` extension that only
//  exists after compilation:
//
//      import { apiRouter } from './api/routes.js';   // file is routes.ts
//
//  Appending extensions to that base yields `routes.js.ts`, which never
//  matches — so an entire NodeNext project resolved zero imports and the
//  reachability BFS produced a one-node graph.
// ============================================================

import * as path from 'path';

/** Source extensions tried when a specifier has no extension at all. */
export const SOURCE_EXTENSIONS = [
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
];

/**
 * Compiled-output extension → the source extensions that produce it.
 * Order matters: prefer the TypeScript source over a same-named JS file.
 */
const OUTPUT_TO_SOURCE: Record<string, string[]> = {
  '.js': ['.ts', '.tsx', '.js', '.jsx'],
  '.jsx': ['.tsx', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
};

/**
 * All paths an import might resolve to, most specific first.
 *
 * @param base The specifier resolved against the importing file's directory.
 * @param extensions Extensions to try when `base` has none.
 */
export function importCandidatePaths(
  base: string,
  extensions: string[] = SOURCE_EXTENSIONS,
): string[] {
  const candidates: string[] = [base];

  // `./routes.js` → `./routes.ts`, `./routes.tsx`, …
  const ext = path.extname(base);
  const sourceExts = OUTPUT_TO_SOURCE[ext];
  if (sourceExts) {
    const stem = base.slice(0, base.length - ext.length);
    for (const e of sourceExts) candidates.push(stem + e);
  }

  // `./routes` → `./routes.ts`
  for (const e of extensions) candidates.push(base + e);

  // `./api` → `./api/index.ts`
  for (const e of extensions) candidates.push(base + '/index' + e);

  return candidates;
}
