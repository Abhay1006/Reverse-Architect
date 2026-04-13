import type { ArchGraph } from '../../../../shared/types.js';
import { runDFS, type DFSVisitor } from './dfs.js';

/**
 * Detects circular dependencies within the architecture graph using DFS.
 * 
 * @param graph The ArchGraph to analyze
 * @returns An array of cycles, where each cycle is an array of node IDs
 */
export function detectCycles(graph: ArchGraph): string[][] {
  const cycles: string[][] = [];
  const currentPath: string[] = [];
  
  const visitor: DFSVisitor = {
    discoverNode: (nodeId: string) => {
      // Track the path of nodes currently being visited
      currentPath.push(nodeId);
    },
    
    finishNode: (nodeId: string) => {
      // Remove node from path once fully explored
      currentPath.pop();
    },
    
    onBackEdge: (source: string, target: string) => {
      // A back-edge indicates a cycle.
      // Search for the target node in the current path to reconstruct the cycle.
      const targetIndex = currentPath.indexOf(target);
      
      if (targetIndex !== -1) {
        // Extract the cycle from target back to target
        // e.g., if path is [A, B, C] and back-edge is from C to B
        // targetIndex is 1 (B), cycle is [B, C]
        const cycle = currentPath.slice(targetIndex);
        cycles.push(cycle);
      } else {
        // Fallback (though targetIndex should always be found on a valid back-edge)
        cycles.push([target, source]);
      }
    }
  };
  
  runDFS(graph, visitor);
  
  // Optional: Remove duplicate cycles depending on traversal order.
  // To uniquely identify a cycle, we can sort its nodes and serialize as a string.
  const uniqueCyclesMap = new Map<string, string[]>();
  
  for (const cycle of cycles) {
    // Sort nodes to create a canonical representation of the cycle
    const canonicalKey = [...cycle].sort().join('|');
    if (!uniqueCyclesMap.has(canonicalKey)) {
      uniqueCyclesMap.set(canonicalKey, cycle);
    }
  }
  
  return Array.from(uniqueCyclesMap.values());
}
