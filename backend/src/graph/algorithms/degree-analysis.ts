import type { ArchGraph } from 'shared';

export interface NodeDegrees {
  inDegree: number;
  outDegree: number;
}

/**
 * Calculates the in-degree and out-degree for every node in the graph.
 * 
 * @param graph The ArchGraph to analyze
 * @returns A mapping of node IDs to their respective degrees
 */
export function calculateDegrees(graph: ArchGraph): Map<string, NodeDegrees> {
  const degrees = new Map<string, NodeDegrees>();

  // Initialize degrees to 0 for all nodes
  for (const node of graph.nodes) {
    degrees.set(node.id, { inDegree: 0, outDegree: 0 });
  }

  // Iterate over all edges to populate the degrees
  for (const edge of graph.edges) {
    const sourceDeg = degrees.get(edge.source);
    const targetDeg = degrees.get(edge.target);

    if (sourceDeg) {
      sourceDeg.outDegree += 1;
    }
    if (targetDeg) {
      targetDeg.inDegree += 1;
    }
  }

  return degrees;
}
