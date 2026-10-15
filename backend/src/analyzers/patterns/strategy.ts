import type { ArchGraph, PatternMatch } from 'shared';

const STRATEGY_NAME = /(strategy|policy|algorithm)$/i;

/**
 * Heuristic check for Strategy pattern, run over the whole graph because it
 * is a relationship rather than a property of one class.
 *
 * An interface (or base class) with two or more interchangeable
 * implementations is a strategy when its name says so, or when it exposes a
 * single operation — the classic shape of a swappable algorithm.
 */
export function detectStrategies(graph: ArchGraph): PatternMatch[] {
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));
  const implementors = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.type !== 'implements' && edge.type !== 'extends') continue;
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    // File-level mirrors of these edges also exist; only entities count.
    if (!source || !target || source.type !== 'class') continue;
    if (target.type !== 'interface' && target.type !== 'class') continue;
    const list = implementors.get(target.id) ?? [];
    list.push(source.id);
    implementors.set(target.id, list);
  }

  const matches: PatternMatch[] = [];
  for (const [targetId, impls] of implementors) {
    if (impls.length < 2) continue;
    const target = nodesById.get(targetId)!;
    const methods = target.metadata.methods ?? [];
    const named = STRATEGY_NAME.test(target.label);
    const singleOperation = methods.length === 1;
    if (!named && !singleOperation) continue;

    const implLabels = impls.map(id => nodesById.get(id)?.label ?? id);
    const reasons = [
      `${impls.length} classes implement "${target.label}": ${implLabels.slice(0, 5).join(', ')}`,
    ];
    if (named) reasons.push(`name "${target.label}" reads as a strategy`);
    if (singleOperation) reasons.push(`declares a single operation "${methods[0]}"`);

    matches.push({
      nodeId: targetId,
      pattern: 'strategy',
      confidence: named ? 'high' : 'medium',
      reasons,
      relatedNodeIds: impls,
    });
  }
  return matches;
}
