import type { ArchEdge, ArchGraph, ArchNode } from '../../../shared/types.js';

/** Terse node factory for analyzer tests. */
export function node(id: string, type: ArchNode['type'], extra: Partial<ArchNode> & { methods?: string[]; properties?: string[]; complexity?: number } = {}): ArchNode {
  const { methods, properties, complexity, ...rest } = extra;
  return {
    id,
    label: id.split(':').pop()!,
    type,
    filePath: `src/${id.split(':').pop()}.ts`,
    metadata: {
      lineCount: 10,
      exportCount: 0,
      maxComplexity: complexity ?? 1,
      ...(methods ? { methods } : {}),
      ...(properties ? { properties } : {}),
    },
    position: { x: 0, y: 0 },
    ...rest,
  };
}

export function edge(source: string, target: string, type: ArchEdge['type'] = 'import', extra: Partial<ArchEdge> = {}): ArchEdge {
  return { id: `${type}:${source}->${target}`, source, target, type, ...extra };
}

export function graph(nodes: ArchNode[], edges: ArchEdge[] = []): ArchGraph {
  return { nodes, edges, analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] } };
}
