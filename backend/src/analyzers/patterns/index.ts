import type { ArchGraph, PatternMatch } from 'shared';
import { detectSingleton } from './singleton.js';
import { detectObserver } from './observer.js';
import { detectFactory } from './factory.js';

/**
 * Runs all heuristic pattern detection rules across the graph.
 * 
 * @param graph The architecture graph to analyze
 * @returns Array of pattern matches
 */
export function detectPatterns(graph: ArchGraph): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'class') continue;

    // Run each pattern detector
    const singletonMatch = detectSingleton(node);
    if (singletonMatch && singletonMatch.confidence !== 'low') matches.push(singletonMatch);

    const observerMatch = detectObserver(node);
    if (observerMatch && observerMatch.confidence !== 'low') matches.push(observerMatch);

    const factoryMatch = detectFactory(node);
    if (factoryMatch && factoryMatch.confidence !== 'low') matches.push(factoryMatch);
  }

  return matches;
}
