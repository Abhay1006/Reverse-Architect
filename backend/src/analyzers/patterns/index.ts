import type { ArchGraph, PatternMatch } from 'shared';
import { detectSingleton } from './singleton.js';
import { detectObserver } from './observer.js';
import { detectFactory } from './factory.js';
import { detectBuilder } from './builder.js';
import { detectStrategies } from './strategy.js';
import { detectAdapters } from './adapter.js';

const NODE_DETECTORS = [detectSingleton, detectObserver, detectFactory, detectBuilder];

/**
 * Runs all heuristic pattern detection rules across the graph.
 * Low-confidence matches are dropped: they are mostly naming coincidences.
 *
 * @param graph The architecture graph to analyze
 * @returns Array of pattern matches
 */
export function detectPatterns(graph: ArchGraph): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'class') continue;
    for (const detect of NODE_DETECTORS) {
      const match = detect(node);
      if (match) matches.push(match);
    }
  }
  matches.push(...detectStrategies(graph), ...detectAdapters(graph));

  return matches.filter(m => m.confidence !== 'low');
}
