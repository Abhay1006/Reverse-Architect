import type { ArchEdge, AnalysisResult } from '../../../shared/types.js';
import type { PositionedGraph, PositionedNode } from './layout.js';

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    filePath: string;
    nodeType: "file" | "class" | "interface" | "function" | "database" | "group";
    metadata: any;
    width: number;
    height: number;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string | undefined;
  label?: string | undefined;
  animated?: boolean | undefined;
}

export interface ReactFlowGraph {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  analysis: AnalysisResult;
}

/**
 * Converts the internal PositionedGraph to a React Flow compatible JSON structure.
 * 
 * @param graph The ArchGraph with positions calculated by Dagre
 * @returns A JSON structure ready to be consumed by React Flow
 */
export function serializeToReactFlow(graph: PositionedGraph): ReactFlowGraph {
  const nodes: ReactFlowNode[] = graph.nodes.map((node: PositionedNode) => ({
    id: node.id,
    // React Flow uses 'type' to determine which Custom Node component to render
    type: node.type, 
    position: { x: node.x, y: node.y },
    data: {
      label: node.label,
      filePath: node.filePath,
      nodeType: node.type,
      metadata: node.metadata,
      width: node.width,
      height: node.height,
    }
  }));

  const edges: ReactFlowEdge[] = graph.edges.map((edge: ArchEdge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type, // Map 'import', 'extends', 'implements' to React Flow custom edge types (optional)
    label: edge.label,
    // Optional aesthetic touch: make import edges animated
    animated: edge.type === 'import'
  }));

  return {
    nodes,
    edges,
    analysis: graph.analysis
  };
}
