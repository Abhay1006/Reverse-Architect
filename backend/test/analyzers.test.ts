import { describe, it, expect } from 'vitest';
import { detectGodObjects } from '../src/analyzers/god-object.js';
import { detectDeadCode } from '../src/analyzers/dead-code.js';
import type { ArchGraph } from '../../shared/types.js';

const mockGraph: ArchGraph = {
  nodes: [
    { id: '1', label: 'GodClass', type: 'class', filePath: 'src/god.ts', metadata: { lineCount: 500, exportCount: 1, maxComplexity: 50 }, position: { x: 0, y: 0 } },
    { id: '2', label: 'UnusedClass', type: 'class', filePath: 'src/unused.ts', metadata: { lineCount: 20, exportCount: 1, maxComplexity: 2 }, position: { x: 0, y: 0 } },
    { id: '3', label: 'ClientClass1', type: 'class', filePath: 'src/client1.ts', metadata: { lineCount: 50, exportCount: 1, maxComplexity: 5 }, position: { x: 0, y: 0 } },
    { id: '4', label: 'ClientClass2', type: 'class', filePath: 'src/client2.ts', metadata: { lineCount: 50, exportCount: 1, maxComplexity: 5 }, position: { x: 0, y: 0 } },
    { id: '5', label: 'ClientClass3', type: 'class', filePath: 'src/client3.ts', metadata: { lineCount: 50, exportCount: 1, maxComplexity: 5 }, position: { x: 0, y: 0 } },
    { id: '6', label: 'EntryFile', type: 'file', filePath: 'src/main.ts', metadata: { lineCount: 50, exportCount: 0, maxComplexity: 5 }, position: { x: 0, y: 0 } }
  ],
  edges: [
    { id: 'e1', source: '3', target: '1', type: 'import' },
    { id: 'e2', source: '4', target: '1', type: 'import' },
    { id: 'e3', source: '5', target: '1', type: 'import' },
    { id: 'e7', source: '2', target: '1', type: 'import' }
  ],
  analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] }
};

describe('God Object Analyzer', () => {
  it('should flag node as god object if degree exceeds threshold', () => {
    // With threshold = 3, GodClass (degree 4) should be flagged
    const hits = detectGodObjects(mockGraph, 3);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.nodeId).toBe('1');
    expect(hits[0]?.totalDegree).toBe(4);

    // With threshold = 5, no node should be flagged
    const hitsHigh = detectGodObjects(mockGraph, 5);
    expect(hitsHigh).toHaveLength(0);
  });
});

describe('Dead Code Analyzer', () => {
  it('should flag node with 0 in-degree that is not a recognized entry point', () => {
    // EntryFile (src/main.ts) matches entry point heuristic guessEntryPoints (main.*)
    // UnusedClass, ClientClass1, ClientClass2, ClientClass3 have 0 in-degree and are not entry points
    const hits = detectDeadCode(mockGraph);
    const hitIds = hits.map(h => h.nodeId);
    
    expect(hitIds).toContain('2'); // UnusedClass
    expect(hitIds).toContain('3'); // ClientClass1
    expect(hitIds).not.toContain('6'); // EntryFile (excluded by heuristic)
  });

  it('should respect explicit entry points list', () => {
    // If we pass '2' (UnusedClass) as an explicit entry point, it shouldn't be flagged as dead
    const hits = detectDeadCode(mockGraph, ['2']);
    const hitIds = hits.map(h => h.nodeId);
    
    expect(hitIds).not.toContain('2'); // Explicitly ignored
    expect(hitIds).toContain('6'); // '6' has 0 in-degree and was NOT in the explicit list, so it gets flagged
  });
});
