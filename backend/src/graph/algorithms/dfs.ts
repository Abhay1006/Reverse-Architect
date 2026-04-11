import type { ArchGraph } from '../../../../shared/types.js';

/**
 * Node visit states for DFS
 */
export enum VisitState {
  UNVISITED,
  VISITING,
  VISITED
}

/**
 * Visitor interface for DFS traversal
 */
export interface DFSVisitor {
  discoverNode?: (nodeId: string) => void;
  finishNode?: (nodeId: string) => void;
  onBackEdge?: (source: string, target: string) => void;
}

/**
 * Runs a Depth-First Search on the provided graph.
 * 
 * @param graph The ArchGraph to traverse
 * @param visitor Callbacks for traversal events
 */
export function runDFS(graph: ArchGraph, visitor: DFSVisitor): void {
  const adjacencyList = new Map<string, string[]>();
  
  // Build adjacency list for efficient traversal
  // ArchEdge source and target are node IDs
  for (const edge of graph.edges) {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  }

  const visited = new Map<string, VisitState>();
  for (const node of graph.nodes) {
    visited.set(node.id, VisitState.UNVISITED);
  }

  const visit = (nodeId: string) => {
    visited.set(nodeId, VisitState.VISITING);
    visitor.discoverNode?.(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      const state = visited.get(neighborId);

      if (state === VisitState.UNVISITED) {
        visit(neighborId);
      } else if (state === VisitState.VISITING) {
        // Standard DFS cycle detection:
        // Encountering a VISITING node means we've hit the current recursion stack.
        visitor.onBackEdge?.(nodeId, neighborId);
      }
    }

    visited.set(nodeId, VisitState.VISITED);
    visitor.finishNode?.(nodeId);
  };

  // Run DFS on all nodes to handle disconnected components (forest of trees)
  for (const node of graph.nodes) {
    if (visited.get(node.id) === VisitState.UNVISITED) {
      visit(node.id);
    }
  }
}
