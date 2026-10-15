import { describe, it, expect } from 'vitest';
import { runDFS } from '../src/graph/algorithms/dfs.js';
import type { ArchGraph } from '../../shared/types.js';

const mockGraph: ArchGraph = {
  nodes: [
    { id: 'A', label: 'A', type: 'file', filePath: '', metadata: { lineCount: 0, exportCount: 0, maxComplexity: 0 }, position: { x: 0, y: 0 } },
    { id: 'B', label: 'B', type: 'file', filePath: '', metadata: { lineCount: 0, exportCount: 0, maxComplexity: 0 }, position: { x: 0, y: 0 } },
    { id: 'C', label: 'C', type: 'file', filePath: '', metadata: { lineCount: 0, exportCount: 0, maxComplexity: 0 }, position: { x: 0, y: 0 } }
  ],
  edges: [
    { id: 'e1', source: 'A', target: 'B', type: 'import' },
    { id: 'e2', source: 'B', target: 'C', type: 'import' },
    { id: 'e3', source: 'C', target: 'A', type: 'import' } // Cycle: A -> B -> C -> A
  ],
  analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] }
};

describe('DFS Traversal', () => {
  it('should correctly traverse all nodes and detect cycles', () => {
    let cycleDetected = false;
    const visitOrder: string[] = [];

    runDFS(mockGraph, {
      discoverNode: (nodeId) => {
        visitOrder.push(nodeId);
      },
      onBackEdge: () => {
        cycleDetected = true;
      },
      finishNode: () => {
        // finished
      }
    });

    expect(cycleDetected).toBe(true);
    expect(visitOrder.length).toBe(3);
    expect(visitOrder).toContain('A');
    expect(visitOrder).toContain('B');
    expect(visitOrder).toContain('C');
  });
});
