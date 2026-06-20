// ============================================================
//  Atlas-TS — Dead Code Analyzer
//  Finds nodes with 0 in-degree (nothing imports/extends them),
//  excluding known entry points. These are potentially unused
//  files, classes, interfaces, or functions.
// ============================================================

import type { ArchGraph } from 'shared';
import { calculateDegrees } from '../graph/algorithms/degree-analysis.js';

// ---------------------------------------------------------------------------
//  Result type
// ---------------------------------------------------------------------------

export interface DeadCodeHit {
  /** The ID of the flagged node */
  nodeId: string;
  /** The node's label (display name) */
  label: string;
  /** Node type (file, class, interface, function) */
  nodeType: string;
  /** File path of the node */
  filePath: string;
  /** Outgoing edge count — dead code may still import things */
  outDegree: number;
}

// ---------------------------------------------------------------------------
//  Heuristic entry-point detection
// ---------------------------------------------------------------------------

/**
 * Guesses which node IDs are entry points so they aren't flagged as dead code.
 * Entry points naturally have 0 in-degree but aren't dead.
 *
 * Heuristics:
 *  - Files named index.*, main.*, app.*, server.*, cli.*
 *  - File-type nodes that have outDegree > 0 (they import things → likely roots)
 */
function guessEntryPoints(graph: ArchGraph): Set<string> {
  const entryPatterns = /\/(index|main|app|server|cli)\.\w+$/i;
  const entries = new Set<string>();

  for (const node of graph.nodes) {
    // Named entry-point files
    if (node.type === 'file' && entryPatterns.test(node.filePath)) {
      entries.add(node.id);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
//  Analyzer
// ---------------------------------------------------------------------------

/**
 * Analyzes the architecture graph and returns dead-code hits.
 *
 * @param graph       The ArchGraph to analyze
 * @param entryPoints Optional explicit entry-point IDs to exclude.
 *                    If empty, heuristic detection is used.
 * @returns Array of DeadCodeHit, sorted by label alphabetically.
 */
export function detectDeadCode(
  graph: ArchGraph,
  entryPoints?: string[],
): DeadCodeHit[] {
  const degrees = calculateDegrees(graph);
  const entrySet =
    entryPoints && entryPoints.length > 0
      ? new Set(entryPoints)
      : guessEntryPoints(graph);

  const hits: DeadCodeHit[] = [];

  for (const node of graph.nodes) {
    const deg = degrees.get(node.id);
    if (!deg) continue;

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

/**
 * Convenience: returns just the node IDs flagged as dead code.
 * Use this to populate `AnalysisResult.deadCode`.
 */
export function getDeadCodeIds(
  graph: ArchGraph,
  entryPoints?: string[],
): string[] {
  return detectDeadCode(graph, entryPoints).map((h) => h.nodeId);
}
