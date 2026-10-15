// ============================================================
//  Atlas — Hotspot Analyzer
//  A hotspot is code that is both complicated and widely depended
//  on: a change there is the most likely to break something, and
//  the hardest to get right.
// ============================================================

import type { ArchGraph } from 'shared';
import { calculateDegrees } from '../graph/algorithms/degree-analysis.js';

/** Estimated cyclomatic complexity at which a function is worth a look. */
const HOTSPOT_MIN_COMPLEXITY = 10;
const HOTSPOT_LIMIT = 25;

export interface HotspotHit {
  nodeId: string;
  label: string;
  filePath: string;
  complexity: number;
  inDegree: number;
  lineCount: number;
  /** complexity × (1 + in-degree): risk grows with both. */
  score: number;
}

/**
 * Ranks functions and classes by complexity weighted by fan-in.
 *
 * @returns At most {@link HOTSPOT_LIMIT} hits, highest score first.
 */
export function detectHotspots(
  graph: ArchGraph,
  minComplexity: number = HOTSPOT_MIN_COMPLEXITY,
): HotspotHit[] {
  const degrees = calculateDegrees(graph);
  const hits: HotspotHit[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'function' && node.type !== 'class') continue;
    const complexity = node.metadata.maxComplexity;
    if (complexity < minComplexity) continue;
    const inDegree = degrees.get(node.id)?.inDegree ?? 0;
    hits.push({
      nodeId: node.id,
      label: node.label,
      filePath: node.filePath,
      complexity,
      inDegree,
      lineCount: node.metadata.lineCount,
      score: complexity * (1 + inDegree),
    });
  }

  hits.sort((a, b) => b.score - a.score || a.nodeId.localeCompare(b.nodeId));
  return hits.slice(0, HOTSPOT_LIMIT);
}
