import { describe, it, expect } from 'vitest';
import { detectGodObjects, adaptiveGodObjectThreshold, MIN_GOD_OBJECT_DEGREE } from '../src/analyzers/god-object.js';
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
  it('should use an adaptive threshold with a floor by default', () => {
    // The mock graph's busiest node has degree 4 — below the floor, so nothing is flagged.
    expect(detectGodObjects(mockGraph)).toHaveLength(0);
    expect(adaptiveGodObjectThreshold([])).toBe(MIN_GOD_OBJECT_DEGREE);
    // One hub among many small nodes stands out; the small ones do not.
    const degrees = [...Array(40).fill(2), 60];
    const threshold = adaptiveGodObjectThreshold(degrees);
    expect(threshold).toBeGreaterThanOrEqual(MIN_GOD_OBJECT_DEGREE);
    expect(threshold).toBeLessThan(60);
  });

  it('should only flag files and classes', () => {
    const fn = { id: 'f', label: 'helper', type: 'function' as const, filePath: 'src/h.ts', metadata: { lineCount: 1, exportCount: 0, maxComplexity: 1 }, position: { x: 0, y: 0 } };
    const graph: ArchGraph = {
      nodes: [fn],
      edges: Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, source: 'f', target: `x${i}`, type: 'calls' as const })),
      analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] },
    };
    expect(detectGodObjects(graph, 1)).toHaveLength(0);
  });

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

  it('should respect explicit entry points in addition to the naming heuristics', () => {
    // '2' (UnusedClass) is passed explicitly; '6' (src/main.ts) still matches the heuristic.
    const hits = detectDeadCode(mockGraph, ['2']);
    const hitIds = hits.map(h => h.nodeId);

    expect(hitIds).not.toContain('2'); // Explicitly excluded
    expect(hitIds).not.toContain('6'); // Heuristic entry point
    expect(hitIds).toContain('3');
  });

  it('should not flag entities referenced without an edge', () => {
    const hits = detectDeadCode(mockGraph, [], new Set(['3']));
    expect(hits.map(h => h.nodeId)).not.toContain('3');
  });

  it('should treat root-level entry files, tests and configs as entry points', () => {
    const file = (id: string, filePath: string) => ({
      id, label: filePath, type: 'file' as const, filePath,
      metadata: { lineCount: 1, exportCount: 0, maxComplexity: 1 }, position: { x: 0, y: 0 },
    });
    const graph: ArchGraph = {
      nodes: [
        file('root-index', 'index.ts'),
        file('test', 'src/foo.test.ts'),
        file('tests-dir', 'tests/helpers.ts'),
        file('config', 'vite.config.ts'),
        file('orphan', 'src/orphan.ts'),
      ],
      edges: [],
      analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] },
    };
    expect(detectDeadCode(graph).map(h => h.nodeId)).toEqual(['orphan']);
  });

  it('should skip anonymous symbols such as route callbacks', () => {
    const graph: ArchGraph = {
      nodes: [
        { id: 'cb', label: "router.get('/x') callback", type: 'function', filePath: 'src/r.ts', metadata: { lineCount: 1, exportCount: 0, maxComplexity: 1 }, position: { x: 0, y: 0 } },
      ],
      edges: [],
      analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] },
    };
    expect(detectDeadCode(graph)).toHaveLength(0);
  });
});
