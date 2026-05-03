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
  // 1. Enable compound graphs for Sub-flow grouping bounds
  const g = new dagre.graphlib.Graph({ compound: true });
  
  // Use generous defaults to prevent overlap with large metadata nodes
  const ranksep = options.ranksep ?? 100;
  const nodesep = options.nodesep ?? 80;
  const defaultNodeWidth = options.nodeWidth ?? 350;
  const defaultNodeHeight = options.nodeHeight ?? 200;

  // Apply graph defaults and layout direction
  g.setGraph({
    rankdir: options.direction || 'BT',
    ranksep,
    nodesep,
    edgesep: 100,    // Extra space between edges
    marginx: 40,     // Graph margin
    marginy: 40,
    align: 'UL',     // Align nodes upper-left for cleaner reading
  });
  
  // Required to tell dagre we are using a directed graph
  g.setDefaultEdgeLabel(() => ({}));

  const topLevelNodes = graph.nodes.filter(n => !n.parentNode);
  const topLevelIds = new Set(topLevelNodes.map(n => n.id));

  // 1. Add top-level nodes to dagre
  for (const node of topLevelNodes) {
    const propCount = node.metadata?.properties?.length || 0;
    const methodCount = node.metadata?.methods?.length || 0;
    
    // Base estimated height. We will expand this if it has children.
    const estimatedHeight = Math.max(
      defaultNodeHeight,
      90 + (propCount + methodCount) * 22
    );

    g.setNode(node.id, { 
      label: node.label, 
      width: defaultNodeWidth, 
      height: estimatedHeight 
    });
  }

  // 2. Add edges only between top-level nodes
  for (const edge of graph.edges) {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  // 3. Let dagre calculate x/y geometries for top-level nodes
  dagre.layout(g);

  // 4. Map the computed coordinates back to our ArchNode structures
  const positionedNodes: PositionedNode[] = [];
  const parentHeights = new Map<string, number>();

  // Helper to group children by parent
  const childrenByParent = new Map<string, typeof graph.nodes>();
  for (const node of graph.nodes) {
    if (node.parentNode) {
      if (!childrenByParent.has(node.parentNode)) {
        childrenByParent.set(node.parentNode, []);
      }
      childrenByParent.get(node.parentNode)!.push(node);
    }
  }

  // Calculate parent dimensions based on children
  for (const node of topLevelNodes) {
    const pos = g.node(node.id);
    const children = childrenByParent.get(node.id) || [];
    
    // Calculate required height based on children stacking
    // Header is ~80px. Each child gets ~60px vertical space.
    const requiredHeight = Math.max(pos.height, 100 + (children.length * 60));
    parentHeights.set(node.id, requiredHeight);
    
    // Dagre outputs absolute center coordinates. React Flow needs top-left.
    const absoluteX = pos.x - defaultNodeWidth / 2;
    const absoluteY = pos.y - requiredHeight / 2;

    positionedNodes.push({
      ...node,
      x: absoluteX,
      y: absoluteY,
      width: defaultNodeWidth,
      height: requiredHeight,
      style: {
        ...node.style,
        width: defaultNodeWidth,
        height: requiredHeight
      }
    });
  }

  // 5. Assign relative coordinates to children
  for (const [parentId, children] of childrenByParent.entries()) {
    let currentY = 80; // Start below the header
    for (const child of children) {
      // Child coordinates are mathematically relative to the parent for React Flow
      positionedNodes.push({
        ...child,
        x: 20, // Indent inside parent
        y: currentY,
        width: defaultNodeWidth - 40,
        height: 40, // Standard child height
      });
      currentY += 60;
    }
  }

  return {
    ...graph,
    nodes: positionedNodes,
  };
}
