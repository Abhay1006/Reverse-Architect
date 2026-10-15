// ============================================================
//  Atlas-TS — God Object Analyzer
//  Flags nodes whose total degree (in + out) exceeds a
//  configurable threshold. These are "god objects" — entities
//  that know too much or are depended on by too many things.
// ============================================================

import type { ArchGraph } from 'shared';
import { calculateDegrees } from '../graph/algorithms/degree-analysis.js';

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

/** Default total-degree threshold above which a node is flagged. */
export const DEFAULT_GOD_OBJECT_THRESHOLD = 4;

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
 * Analyzes the architecture graph and returns god-object hits.
 *
 * @param graph     The ArchGraph to analyze
 * @param threshold Total degree above which a node is flagged.
 *                  Defaults to {@link DEFAULT_GOD_OBJECT_THRESHOLD}.
 * @returns Array of GodObjectHit, sorted by totalDegree descending.
 */
export function detectGodObjects(
  graph: ArchGraph,
  threshold: number = DEFAULT_GOD_OBJECT_THRESHOLD,
): GodObjectHit[] {
  const degrees = calculateDegrees(graph);
  const hits: GodObjectHit[] = [];

  for (const node of graph.nodes) {
    const deg = degrees.get(node.id);
    if (!deg) continue;

    const totalDegree = deg.inDegree + deg.outDegree;
    if (totalDegree > threshold) {
      hits.push({
        nodeId: node.id,
        label: node.label,
        inDegree: deg.inDegree,
        outDegree: deg.outDegree,
        totalDegree,
      });
    }
  }

  // Sort most-connected first
  hits.sort((a, b) => b.totalDegree - a.totalDegree);

  return hits;
}
