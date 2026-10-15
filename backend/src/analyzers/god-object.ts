// ============================================================
//  Atlas — God Object Analyzer
//  Flags files and classes whose total degree (in + out) is
//  far above the rest of the codebase. These are "god objects" — entities
//  that know too much or are depended on by too many things.
// ============================================================

import type { ArchGraph } from 'shared';
import { calculateDegrees } from '../graph/algorithms/degree-analysis.js';

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

/**
 * Floor for the adaptive threshold. A fixed threshold of 4 flagged 18% of the
 * nodes in a mid-sized TypeScript service — any file importing five others
 * was a "god object", so the signal drowned in noise.
 */
export const MIN_GOD_OBJECT_DEGREE = 10;

/** Only files and classes can be god objects; functions and interfaces are not "objects". */
const CANDIDATE_TYPES = new Set(['file', 'class']);

// ---------------------------------------------------------------------------
//  Result type
// ---------------------------------------------------------------------------

// Defined in the shared package — it is part of the API response body.
export type { GodObjectHit } from 'shared';
import type { GodObjectHit } from 'shared';

// ---------------------------------------------------------------------------
//  Analyzer
// ---------------------------------------------------------------------------

/**
 * The degree a node must exceed to be flagged: two standard deviations above
 * the mean degree of the candidates, and never below MIN_GOD_OBJECT_DEGREE.
 * Relative to the codebase, so it scales from tiny projects to large ones.
 */
export function adaptiveGodObjectThreshold(totalDegrees: number[]): number {
  if (totalDegrees.length === 0) return MIN_GOD_OBJECT_DEGREE;
  const mean = totalDegrees.reduce((a, b) => a + b, 0) / totalDegrees.length;
  const variance = totalDegrees.reduce((a, d) => a + (d - mean) ** 2, 0) / totalDegrees.length;
  return Math.max(MIN_GOD_OBJECT_DEGREE, Math.ceil(mean + 2 * Math.sqrt(variance)));
}

/**
 * Analyzes the architecture graph and returns god-object hits.
 *
 * @param graph     The ArchGraph to analyze
 * @param threshold Total degree above which a node is flagged. Defaults to
 *                  {@link adaptiveGodObjectThreshold} over this graph.
 * @returns Array of GodObjectHit, sorted by totalDegree descending.
 */
export function detectGodObjects(
  graph: ArchGraph,
  threshold?: number,
): GodObjectHit[] {
  const degrees = calculateDegrees(graph);
  const candidates = graph.nodes.filter((node) => CANDIDATE_TYPES.has(node.type));

  const totalDegree = (id: string) => {
    const deg = degrees.get(id);
    return deg ? deg.inDegree + deg.outDegree : 0;
  };
  const limit = threshold ?? adaptiveGodObjectThreshold(candidates.map((n) => totalDegree(n.id)));

  const hits: GodObjectHit[] = [];
  for (const node of candidates) {
    const deg = degrees.get(node.id);
    if (!deg) continue;

    const total = deg.inDegree + deg.outDegree;
    if (total > limit) {
      hits.push({
        nodeId: node.id,
        label: node.label,
        inDegree: deg.inDegree,
        outDegree: deg.outDegree,
        totalDegree: total,
      });
    }
  }

  // Sort most-connected first
  hits.sort((a, b) => b.totalDegree - a.totalDegree);

  return hits;
}
