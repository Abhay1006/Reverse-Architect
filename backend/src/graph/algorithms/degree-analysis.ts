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

/**
 * Identifies god objects in the architecture graph.
 * A god object is defined as a node whose total degree (inDegree + outDegree) exceeds the given threshold.
 * 
 * @param graph The ArchGraph to analyze
 * @param threshold The total degree amount that classifies a node as a "god object"
 * @returns An array of node IDs identified as god objects
 */
export function identifyGodObjects(graph: ArchGraph, threshold: number): string[] {
  const degrees = calculateDegrees(graph);
  const godObjects: string[] = [];

  for (const [nodeId, deg] of degrees.entries()) {
    if ((deg.inDegree + deg.outDegree) > threshold) {
      godObjects.push(nodeId);
    }
  }

  return godObjects;
}

/**
 * Identifies potential dead code in the architecture graph.
 * A node is considered dead code if no other node depends on it (inDegree === 0) 
 * and it is not explicitly marked as an entry point.
 * 
 * @param graph The ArchGraph to analyze
 * @param entryPoints Array of node IDs that serve as the defined entry points of the project
 * @returns An array of node IDs identified as dead code
 */
export function identifyDeadCode(graph: ArchGraph, entryPoints: string[] = []): string[] {
  const degrees = calculateDegrees(graph);
  const deadCodeNodes: string[] = [];
  const entrySet = new Set(entryPoints);

  for (const [nodeId, deg] of degrees.entries()) {
    if (deg.inDegree === 0 && !entrySet.has(nodeId)) {
      deadCodeNodes.push(nodeId);
    }
  }

  return deadCodeNodes;
}
