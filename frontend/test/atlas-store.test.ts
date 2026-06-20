import { describe, it, expect } from 'vitest';
import { getVisibleNodes, getVisibleEdges } from '../src/app/store/atlas-store';
import type { AtlasNode } from '../src/app/types/nodes';
import type { Edge } from '@xyflow/react';

describe('Zustand Store Pure Selectors', () => {
  const mockNodes: AtlasNode[] = [
    {
      id: 'file1',
      type: 'file',
      position: { x: 0, y: 0 },
      data: { filePath: 'src/components/Canvas.tsx', label: 'Canvas.tsx' }
    },
    {
      id: 'class1',
      type: 'class',
      position: { x: 0, y: 0 },
      parentId: 'file1',
      data: { filePath: 'src/components/Canvas.tsx', label: 'CanvasInner' }
    },
    {
      id: 'file2',
      type: 'file',
      position: { x: 0, y: 0 },
      data: { filePath: 'src/store/atlas-store.ts', label: 'atlas-store.ts' }
    },
    {
      id: 'group1',
      type: 'group',
      position: { x: 0, y: 0 },
      data: { label: 'components', filePath: '' }
    }
  ];

  describe('getVisibleNodes', () => {
    it('should return only file nodes when focusPath is empty and no files are expanded', () => {
      const expandedFiles = new Set<string>();
      const visibleNodeTypes = new Set<string>(['file', 'class', 'group']);
      const visible = getVisibleNodes(mockNodes, '', expandedFiles, visibleNodeTypes);

      const ids = visible.map(n => n.id);
      expect(ids).toContain('file1');
      expect(ids).toContain('file2');
      expect(ids).not.toContain('class1');
      expect(ids).not.toContain('group1');
    });

    it('should include entity nodes when parent file is expanded', () => {
      const expandedFiles = new Set<string>(['src/components/Canvas.tsx']);
      const visibleNodeTypes = new Set<string>(['file', 'class', 'group']);
      const visible = getVisibleNodes(mockNodes, '', expandedFiles, visibleNodeTypes);

      const ids = visible.map(n => n.id);
      expect(ids).toContain('file1');
      expect(ids).toContain('class1');
      expect(ids).toContain('file2');
    });

    it('should filter by focusPath folder prefix', () => {
      const expandedFiles = new Set<string>();
      const visibleNodeTypes = new Set<string>(['file', 'class', 'group']);
      
      const visible = getVisibleNodes(mockNodes, 'src/store', expandedFiles, visibleNodeTypes);

      const ids = visible.map(n => n.id);
      expect(ids).toContain('file2');
      expect(ids).not.toContain('file1');
    });
  });

  describe('getVisibleEdges', () => {
    const mockEdges: Edge[] = [
      { id: 'e1', source: 'file1', target: 'file2' },
      { id: 'e2', source: 'file1', target: 'class1' }
    ];

    it('should return edges only if both source and target are visible', () => {
      const visibleNodeIds = new Set<string>(['file1', 'file2']);
      const visibleEdges = getVisibleEdges(mockEdges, visibleNodeIds);

      expect(visibleEdges).toHaveLength(1);
      expect(visibleEdges[0]?.id).toBe('e1');
    });
  });
});
