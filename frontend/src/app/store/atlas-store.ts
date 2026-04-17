import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { AnalysisResult } from '../../../../shared/types';

interface AtlasState {
  // --- Graph State ---
  nodes: Node[];
  edges: Edge[];
  analysisResults: AnalysisResult | null;
  
  // --- UI State ---
  selectedNodeId: string | null;
  searchQuery: string;

  // --- Actions ---
  setGraph: (nodes: Node[], edges: Edge[], analysis: AnalysisResult) => void;
  
  // React Flow required actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  // UI modifiers
  setSelectedNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  highlightNeighbors: (nodeId: string | null) => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  nodes: [],
  edges: [],
  analysisResults: null,
  selectedNodeId: null,
  searchQuery: '',

  setGraph: (nodes, edges, analysisResults) => {
    set({ nodes, edges, analysisResults });
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
    // Automatically trigger highlighting when a node is selected
    get().highlightNeighbors(nodeId);
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  highlightNeighbors: (nodeId) => {
    const { nodes, edges } = get();

    if (!nodeId) {
      // Reset formatting
      set({
        nodes: nodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })),
        edges: edges.map((e) => ({ ...e, animated: e.type === 'import', style: { ...e.style, opacity: 1 } })),
      });
      return;
    }

    // Find all neighbor node IDs
    const neighborIds = new Set<string>([nodeId]);
    edges.forEach((e) => {
      if (e.source === nodeId) neighborIds.add(e.target);
      if (e.target === nodeId) neighborIds.add(e.source);
    });

    set({
      // Dim nodes that use 0.2 opacity if they are not neighbors
      nodes: nodes.map((n) => ({
        ...n,
        style: { ...n.style, opacity: neighborIds.has(n.id) ? 1 : 0.2 },
      })),
      // Highlight connecting edges, dim the rest
      edges: edges.map((e) => {
        const isNeighborEdge = e.source === nodeId || e.target === nodeId;
        return {
          ...e,
          animated: isNeighborEdge, // extra emphasis for active connections
          style: {
            ...e.style,
            opacity: isNeighborEdge ? 1 : 0.2,
          },
        };
      }),
    });
  },
}));
