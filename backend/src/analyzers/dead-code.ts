// ============================================================
//  Atlas — Dead Code Analyzer
//  Finds nodes with 0 in-degree (nothing imports/extends them),
//  excluding known entry points. These are potentially unused
//  files, classes, interfaces, or functions.
// ============================================================

import type { ArchGraph } from 'shared';
import { calculateDegrees } from '../graph/algorithms/degree-analysis.js';

// ---------------------------------------------------------------------------
//  Result type
// ---------------------------------------------------------------------------

// Defined in the shared package — it is part of the API response body.
export type { DeadCodeHit } from 'shared';
import type { DeadCodeHit } from 'shared';

// ---------------------------------------------------------------------------
//  Heuristic entry-point detection
// ---------------------------------------------------------------------------

/**
 * Files that are run by a tool or a runtime rather than imported by other
 * code: conventional entry names (at any depth, including the repo root),
 * tests, and tool configuration.
 */
const ENTRY_FILE_PATTERNS = [
  /(?:^|\/)(?:index|main|app|server|cli)\.\w+$/i,
  /(?:^|\/)(?:__tests__|tests?|spec)\//i,
  /\.(?:test|spec)\.\w+$/i,
  /(?:^|\/)[\w.-]+\.config\.\w+$/i,
];

/** Guesses which file nodes are entry points so they aren't flagged as dead code. */
function guessEntryPoints(graph: ArchGraph): Set<string> {
  const entries = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === 'file' && ENTRY_FILE_PATTERNS.some((re) => re.test(node.filePath))) {
      entries.add(node.id);
    }
  }
  return entries;
}

/**
 * Symbols the language server reports for anonymous code, such as
 * "aiRouter.get('/issues') callback". They are referenced by the call that
 * creates them, which the graph cannot see, so they are never dead code.
 */
const NAMED_SYMBOL_RE = /^[A-Za-z_$][\w$]*$/;

// ---------------------------------------------------------------------------
//  Analyzer
// ---------------------------------------------------------------------------

/**
 * Analyzes the architecture graph and returns dead-code hits.
 *
 * @param graph         The ArchGraph to analyze
 * @param entryPoints   Entry-point node IDs to exclude, in addition to the
 *                      naming heuristics (index/main/tests/configs).
 * @param referencedIds Entity node IDs used without a graph edge — e.g. a
 *                      component imported and rendered at module top level.
 * @returns Array of DeadCodeHit, sorted by label alphabetically.
 */
export function detectDeadCode(
  graph: ArchGraph,
  entryPoints: Iterable<string> = [],
  referencedIds: ReadonlySet<string> = new Set(),
): DeadCodeHit[] {
  const degrees = calculateDegrees(graph);
  const entrySet = guessEntryPoints(graph);
  for (const id of entryPoints) entrySet.add(id);

  const hits: DeadCodeHit[] = [];

  for (const node of graph.nodes) {
    const deg = degrees.get(node.id);
    if (!deg) continue;
    if (node.type !== 'file' && !NAMED_SYMBOL_RE.test(node.label)) continue;
    if (referencedIds.has(node.id)) continue;

    // Dead code = nobody imports/references this node, and it's not an entry point
    if (deg.inDegree === 0 && !entrySet.has(node.id)) {
      hits.push({
        nodeId: node.id,
        label: node.label,
        nodeType: node.type,
        filePath: node.filePath,
        outDegree: deg.outDegree,
      });
    }
  }

  // Sort alphabetically by label for consistent display
  hits.sort((a, b) => a.label.localeCompare(b.label));

  return hits;
}
