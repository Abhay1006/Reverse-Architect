import type { ArchGraph, PatternMatch } from 'shared';

const ADAPTER_NAME = /(adapter|wrapper)$/i;

/**
 * Heuristic check for Adapter pattern.
 * A class named `*Adapter` / `*Wrapper` that implements or extends a target
 * type is adapting something to that type. Without the inheritance edge the
 * name alone is weaker evidence.
 */
export function detectAdapters(graph: ArchGraph): PatternMatch[] {
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));
  const targetsBySource = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== 'implements' && edge.type !== 'extends') continue;
    const list = targetsBySource.get(edge.source) ?? [];
    list.push(edge.target);
    targetsBySource.set(edge.source, list);
  }

  const matches: PatternMatch[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'class' || !ADAPTER_NAME.test(node.label)) continue;
    const targets = (targetsBySource.get(node.id) ?? [])
      .filter(id => nodesById.get(id)?.type !== 'file');
    const reasons = [`class name "${node.label}" ends in "${node.label.match(ADAPTER_NAME)![1]}"`];
    if (targets.length > 0) {
      const labels = targets.map(id => nodesById.get(id)?.label ?? id);
      reasons.push(`implements/extends ${labels.join(', ')}`);
      matches.push({ nodeId: node.id, pattern: 'adapter', confidence: 'high', reasons, relatedNodeIds: targets });
    } else {
      matches.push({ nodeId: node.id, pattern: 'adapter', confidence: 'medium', reasons });
    }
  }
  return matches;
}
