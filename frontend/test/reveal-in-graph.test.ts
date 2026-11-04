import { describe, it, expect, beforeEach } from 'vitest';
import { useAtlasStore } from '../src/app/store/atlas-store';
import type { AtlasNode } from '../src/app/types/nodes';
import type { CustomNodeData } from '../src/app/types/nodes';

const data = (filePath: string, label: string): CustomNodeData => ({
  filePath,
  label,
  metadata: { lineCount: 0, exportCount: 0, maxComplexity: 0 },
  analysis: { isGodObject: false, isDeadCode: false, isEntryPoint: false },
});

const nodes: AtlasNode[] = [
  { id: 'file:src/a.ts', type: 'file', position: { x: 0, y: 0 }, data: data('src/a.ts', 'a.ts') },
  { id: 'class:A', type: 'class', position: { x: 0, y: 0 }, parentId: 'file:src/a.ts', data: data('src/a.ts', 'A') },
  { id: 'file:lib/b.ts', type: 'file', position: { x: 0, y: 0 }, data: data('lib/b.ts', 'b.ts') },
];

describe('revealInGraph', () => {
  beforeEach(() => {
    useAtlasStore.getState().setGraph({
      nodes,
      edges: [],
      analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] },
      godObjectDetails: [],
      deadCodeDetails: [],
      entryPoint: null,
      findings: [],
      coverage: null,
    });
  });

  it('starts every new analysis on the overview with nothing selected', () => {
    const s = useAtlasStore.getState();
    expect(s.activeTab).toBe('overview');
    expect(s.selectedNodeId).toBeNull();
  });

  it('switches to the graph and selects the first node that exists', () => {
    useAtlasStore.getState().revealInGraph(['file:missing.ts', 'file:lib/b.ts']);
    const s = useAtlasStore.getState();
    expect(s.activeTab).toBe('graph');
    expect(s.selectedNodeId).toBe('file:lib/b.ts');
    expect(s.panToNodeId).toBe('file:lib/b.ts');
  });

  it('does nothing when none of the nodes are in the graph', () => {
    useAtlasStore.getState().revealInGraph(['file:missing.ts']);
    expect(useAtlasStore.getState().activeTab).toBe('overview');
  });

  it('lifts a folder focus or type filter that would hide the node', () => {
    const store = useAtlasStore.getState();
    store.setFocusPath('lib');
    store.toggleNodeType('class');
    store.collapseAllFiles();
    useAtlasStore.getState().revealInGraph(['class:A']);
    const s = useAtlasStore.getState();
    expect(s.focusPath).toBe('');
    expect(s.visibleNodeTypes.has('class')).toBe(true);
    expect(s.expandedFiles.has('src/a.ts')).toBe(true);
  });

  it('keeps a folder focus that already contains the node', () => {
    useAtlasStore.getState().setFocusPath('src');
    useAtlasStore.getState().revealInGraph(['file:src/a.ts']);
    expect(useAtlasStore.getState().focusPath).toBe('src');
  });
});
