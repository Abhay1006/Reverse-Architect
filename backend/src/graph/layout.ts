import dagre from 'dagre';
import type { ArchGraph, ArchNode } from '../../../shared/types.js';

export interface LayoutOptions {
  /**
   * Layout direction: TB (Top-to-Bottom), BT (Bottom-to-Top), LR (Left-to-Right), RL (Right-to-Left).
   * Default: 'TB'
   */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Default: 150 */
  nodeWidth?: number;
  /** Default: 50 */
  nodeHeight?: number;
  /** Rank separation (distance between layers). Default: 50 */
  ranksep?: number;
  /** Node separation (distance between nodes in same layer). Default: 50 */
  nodesep?: number;
}

export interface PositionedNode extends ArchNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedGraph extends Omit<ArchGraph, 'nodes'> {
  nodes: PositionedNode[];
}

/**
 * Computes x/y positions for all nodes in the architecture graph using Dagre.
 * 
 * @param graph The ArchGraph to calculate the layout for.
 * @param options Configuration for direction, spacing, and dimensions.
 * @returns A new graph object where nodes contain x, y coordinates along with width and height.
 */
export function computeLayout(graph: ArchGraph, options: LayoutOptions = {}): PositionedGraph {
  const g = new dagre.graphlib.Graph();
  
  // Apply graph defaults and layout direction
  g.setGraph({
    rankdir: options.direction || 'TB',
    ranksep: options.ranksep ?? 50,
    nodesep: options.nodesep ?? 50,
  });
  
  // Required to tell dagre we are using a directed graph
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = options.nodeWidth ?? 150;
  const nodeHeight = options.nodeHeight ?? 50;

  // 1. Add all nodes to the dagre graph
  for (const node of graph.nodes) {
    g.setNode(node.id, { 
      label: node.name, 
      width: nodeWidth, 
      height: nodeHeight 
    });
  }

  // 2. Add all edges to the dagre graph
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  // 3. Let dagre calculate x/y geometries for every node
  dagre.layout(g);

  // 4. Map the computed coordinates back to our ArchNode structures
  const positionedNodes: PositionedNode[] = graph.nodes.map(node => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      x: dagreNode.x,
      y: dagreNode.y,
      width: dagreNode.width,
      height: dagreNode.height,
    };
  });

  return {
    ...graph,
    nodes: positionedNodes,
  };
}
