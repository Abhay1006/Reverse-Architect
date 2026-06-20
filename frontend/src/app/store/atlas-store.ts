import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { AnalysisResult } from 'shared';
import type { GodObjectDetail, DeadCodeDetail, EntryPoint } from '../lib/atlas-api';
import type { AtlasNode } from '../types/nodes';

// ── Folder Tree Types ─────────────────────────────────────────────────

export interface FolderTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: FolderTreeNode[];
  /** Number of graph nodes (files/entities) that live directly in this folder */
  nodeCount: number;
  /** Type of node if it's a file-level entry */
  nodeType?: string;
  /** The graph node ID, if this tree entry maps to a single graph node */
  nodeId?: string;
  /** Whether this file is the project entry point */
  isEntryPoint?: boolean;
}

// ── Store Interface ───────────────────────────────────────────────────

interface AtlasState {
  // --- Graph State ---
  nodes: AtlasNode[];
  edges: Edge[];
  analysisResults: AnalysisResult | null;
  godObjectDetails: GodObjectDetail[];
  deadCodeDetails: DeadCodeDetail[];
  
  // --- UI State ---
  selectedNodeId: string | null;
  searchQuery: string;
  focusPath: string;       // Current folder focus (e.g. "src/graph")
  expandedFolders: Set<string>; // Track which folders are expanded in the tree
  expandedFiles: Set<string>;   // Track which files are expanded to show internal functions
  entryPoint: EntryPoint | null; // Detected project entry point
  fitViewTrigger: number; // Increment to trigger fitView in component
  panToNodeId: string | null; // Node to pan to
  focusedNodeId: string | null; // Node currently in isolated focus mode
  hasGuidedTourShown: boolean;
  visibleNodeTypes: Set<string>; // Node type filter (which types are visible)
  showEdgeLabels: boolean;       // Toggle edge label visibility
  isLoading: boolean;            // Global loading/analyzing state
  graphMode: '2D' | '3D';        // Toggle between 2D and 3D view modes
  progressText: string;          // SSE progress text status
  activeRepoId: string | null;   // Active repo/session ID for code peeking
  codePeekFile: { filePath: string; label: string } | null; // Currently peeking file
  heatmapEnabled: boolean;       // Complexity heatmap toggle
  snackbarMessage: string | null;

  // --- Actions ---
  setGraph: (nodes: AtlasNode[], edges: Edge[], analysis: AnalysisResult, godObjectDetails?: GodObjectDetail[], deadCodeDetails?: DeadCodeDetail[], entryPoint?: EntryPoint, repoId?: string) => void;
  
  // React Flow required actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  // UI modifiers
  setSelectedNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  highlightNeighbors: (nodeId: string | null) => void;
  setFocusPath: (path: string) => void;
  toggleFolder: (path: string) => void;
  toggleFileExpansion: (filePath: string) => void;
  triggerFitView: () => void;
  panToNode: (nodeId: string | null) => void;
  setFocusedNode: (nodeId: string | null) => void;
  setHasGuidedTourShown: (shown: boolean) => void;
  toggleNodeType: (type: string) => void;
  toggleEdgeLabels: () => void;
  setGraphMode: (mode: '2D' | '3D') => void;
  setIsLoading: (loading: boolean) => void;
  setProgressText: (text: string) => void;
  expandAllFiles: () => void;
  collapseAllFiles: () => void;
  setCodePeekFile: (file: { filePath: string; label: string } | null) => void;
  toggleHeatmap: () => void;
  setSnackbarMessage: (message: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build a folder tree structure from graph node file paths.
 * This is a pure function used as a selector.
 */
export function buildFolderTree(nodes: AtlasNode[]): FolderTreeNode {
  const root: FolderTreeNode = {
    name: '/',
    path: '',
    isFolder: true,
    children: [],
    nodeCount: 0,
  };

  // Collect all unique file paths, ignoring group nodes
  for (const node of nodes) {
    const filePath = (node.data?.filePath as string) || '';
    if (!filePath || node.type === 'group') continue;

    // Normalize: strip leading slashes and common prefixes
    const cleanPath = filePath.replace(/^\/+/, '');
    const parts = cleanPath.split('/');

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part!,
          path: currentPath,
          isFolder: !isFile,
          children: [],
          nodeCount: 0,
        };
        current.children.push(child);
      }

      if (isFile) {
        child.nodeType = node.type;
        child.nodeId = node.id;
        child.isFolder = false;
        child.isEntryPoint = !!node.data?.analysis?.isEntryPoint;
      }

      current = child;
    }
  }

  // Sort: folders first, then alphabetically
  function sortTree(node: FolderTreeNode) {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      sortTree(child);
    }
    // Count direct non-folder children
    node.nodeCount = node.children.filter(c => !c.isFolder).length;
  }

  sortTree(root);
  return root;
}

/**
 * Get the nodes visible at a given focus path level.
 * Shows files and entities whose filePath starts with focusPath.
 */
export function getVisibleNodes(
  allNodes: AtlasNode[],
  focusPath: string,
  expandedFiles: Set<string>,
  visibleNodeTypes?: Set<string>
): AtlasNode[] {
  // When a specific folder is focused, we want to show:
  // 1. Files inside that folder
  // 2. Groups that contain those files
  // 3. Entities inside those files ONLY IF the file is expanded
  
  const cleanFocusPath = focusPath ? focusPath.replace(/^\/+/, '') : '';
  const visibleFilePaths = new Set<string>();
  const visibleGroupIds = new Set<string>();
  
  // First pass: identify visible files and their groups
  allNodes.forEach(n => {
    if (n.type === 'file' && n.data?.filePath) {
      const fp = n.data.filePath as string;
      const cleanFp = fp.replace(/^\/+/, '');
      if (!cleanFocusPath || cleanFp.startsWith(cleanFocusPath)) {
        visibleFilePaths.add(fp);
        if (n.parentId) visibleGroupIds.add(n.parentId);
      }
    }
  });
  
  // Second pass: filter nodes
  return allNodes.filter(n => {
    if (n.type === 'group') {
      return visibleGroupIds.has(n.id);
    }
    
    const fp = n.data?.filePath as string;
    if (!fp || !visibleFilePaths.has(fp)) return false;

    // Filter by type if visibility set is provided
    if (visibleNodeTypes && !visibleNodeTypes.has(n.type ?? 'file')) {
      return false;
    }

    if (n.type === 'file') {
      return true;
    }

    // It's an entity node (function, class, interface, database)
    // Only show it if its parent file is explicitly expanded
    return expandedFiles.has(fp);
  });
}

/**
 * Get edges that connect two visible nodes.
 */
export function getVisibleEdges(allEdges: Edge[], visibleNodeIds: Set<string>): Edge[] {
  return allEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
}

// ── Store ─────────────────────────────────────────────────────────────

export const useAtlasStore = create<AtlasState>((set, get) => ({
  nodes: [],
  edges: [],
  analysisResults: null,
  godObjectDetails: [],
  deadCodeDetails: [],
  selectedNodeId: null,
  searchQuery: '',
  focusPath: '',
  expandedFolders: new Set<string>(),
  expandedFiles: new Set<string>(),
  entryPoint: null,
  fitViewTrigger: 0,
  panToNodeId: null,
  focusedNodeId: null,
  hasGuidedTourShown: false,
  visibleNodeTypes: new Set<string>(['file', 'class', 'interface', 'function', 'database', 'group']),
  showEdgeLabels: true,
  isLoading: false,
  graphMode: '2D',
  progressText: '',
  activeRepoId: null,
  codePeekFile: null,
  heatmapEnabled: false,
  snackbarMessage: null,

  setGraph: (nodes, edges, analysisResults, godObjectDetails, deadCodeDetails, entryPoint, repoId) => {
    const filePaths = new Set<string>();
    nodes.forEach(n => {
      if (n.type === 'file' && n.data?.filePath) {
        filePaths.add(n.data.filePath as string);
      }
    });

    set({ 
      nodes, 
      edges, 
      analysisResults, 
      godObjectDetails: godObjectDetails ?? [], 
      deadCodeDetails: deadCodeDetails ?? [],
      entryPoint: entryPoint ?? null,
      activeRepoId: repoId ?? null,
      codePeekFile: null, // Clear active peek when new project is loaded
      focusPath: '',  // Reset focus on new graph
      expandedFolders: new Set<string>(),
      expandedFiles: filePaths,
      focusedNodeId: null,
    });
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as AtlasNode[],
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

  setFocusPath: (path) => {
    set({ focusPath: path, selectedNodeId: null });
  },

  toggleFolder: (path) => {
    set(state => {
      const next = new Set(state.expandedFolders);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedFolders: next };
    });
  },

  toggleFileExpansion: (filePath) => {
    set(state => {
      const next = new Set(state.expandedFiles);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return { expandedFiles: next };
    });
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

  triggerFitView: () => {
    set({ fitViewTrigger: get().fitViewTrigger + 1 });
  },

  panToNode: (nodeId) => {
    set({ panToNodeId: nodeId });
    if (nodeId) {
      get().setSelectedNode(nodeId);
    }
  },

  setFocusedNode: (nodeId) => {
    set({ focusedNodeId: nodeId });
    if (nodeId) {
      get().triggerFitView();
    }
  },

  setHasGuidedTourShown: (shown) => {
    set({ hasGuidedTourShown: shown });
  },

  toggleNodeType: (type) => {
    set((state) => {
      const next = new Set(state.visibleNodeTypes);
      if (next.has(type)) {
        // Don't allow hiding all types
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return { visibleNodeTypes: next };
    });
  },

  toggleEdgeLabels: () => {
    set((state) => ({ showEdgeLabels: !state.showEdgeLabels }));
  },

  setGraphMode: (mode) => {
    set({ graphMode: mode });
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading });
  },

  setProgressText: (text) => {
    set({ progressText: text });
  },

  expandAllFiles: () => {
    const { nodes } = get();
    const filePaths = new Set<string>();
    nodes.forEach(n => {
      if (n.type === 'file' && n.data?.filePath) {
        filePaths.add(n.data.filePath as string);
      }
    });
    set({ expandedFiles: filePaths });
  },

  collapseAllFiles: () => {
    set({ expandedFiles: new Set<string>() });
  },

  setCodePeekFile: (file) => {
    set({ codePeekFile: file });
  },

  toggleHeatmap: () => {
    set((state) => ({ heatmapEnabled: !state.heatmapEnabled }));
  },

  setSnackbarMessage: (message) => {
    set({ snackbarMessage: message });
  },
}));
