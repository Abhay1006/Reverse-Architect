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
  const ranksep = options.ranksep ?? 400;
  const nodesep = options.nodesep ?? 300;
  const defaultNodeWidth = options.nodeWidth ?? 350;
  const defaultNodeHeight = options.nodeHeight ?? 200;

  // Apply graph defaults and layout direction
  g.setGraph({
    rankdir: options.direction || 'TB',
    ranksep,
    nodesep,
    edgesep: 100,    // Extra space between edges
    marginx: 40,     // Graph margin
    marginy: 40,
    align: 'UL',     // Align nodes upper-left for cleaner reading
  });
  
  // Required to tell dagre we are using a directed graph
  g.setDefaultEdgeLabel(() => ({}));

  // 1. Add all nodes to the dagre graph
  // First, add all group nodes so they exist before we set them as parents
  for (const node of graph.nodes) {
    if (node.type === 'group') {
      g.setNode(node.id, { label: node.label });
    }
  }

  // Then, add all child nodes and set their parent relationships
  for (const node of graph.nodes) {
    if (node.type !== 'group') {
      const propCount = node.metadata?.properties?.length || 0;
      const methodCount = node.metadata?.methods?.length || 0;
      
      const estimatedHeight = Math.max(
        defaultNodeHeight,
        90 + (propCount + methodCount) * 22
      );

      g.setNode(node.id, { 
        label: node.label, 
        width: defaultNodeWidth, 
        height: estimatedHeight 
      });

      if (node.parentNode) {
        g.setParent(node.id, node.parentNode);
      }
    }
  }

  // 2. Add all edges to the dagre graph
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  // 3. Let dagre calculate x/y geometries for every node
  dagre.layout(g);

  // Debug DAGRE output
  console.log(`Dagre laid out ${g.nodeCount()} nodes. Checking a few group sizes...`);
  const groupNodeKeys = g.nodes().filter(id => id.startsWith('group:'));
  for (const gid of groupNodeKeys) {
    const p = g.node(gid);
    console.log(`Group ${gid}: w=${p.width}, h=${p.height}, x=${p.x}, y=${p.y}`);
  }

  // 4. Map the computed coordinates back to our ArchNode structures
  const positionedNodes: PositionedNode[] = graph.nodes.map(node => {
    const pos = g.node(node.id);
    
    // For groups, Dagre calculates width/height. We add generous padding.
    // For regular nodes, we use the width/height calculated in step 1.
    const width = node.type === 'group' ? (pos?.width || 0) + 160 : (pos?.width || defaultNodeWidth);
    const height = node.type === 'group' ? (pos?.height || 0) + 160 : (pos?.height || defaultNodeHeight);
    
    // Dagre outputs absolute center coordinates. React Flow needs top-left.
    const absoluteX = (pos?.x || 0) - width / 2;
    const absoluteY = (pos?.y || 0) - height / 2;

    const positioned: PositionedNode = {
      ...node,
      x: absoluteX,
      y: absoluteY,
      width,
      height,
    };

    if (node.type === 'group') {
      positioned.style = { 
        ...node.style,
        width, 
        height 
      };
    }

    return positioned;
  });

  return {
    ...graph,
    nodes: positionedNodes,
  };
}
