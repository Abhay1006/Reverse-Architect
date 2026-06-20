import dagre from 'dagre';
import type { ArchGraph, ArchNode } from 'shared';

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
  const ranksep = options.ranksep ?? 100;
  const nodesep = options.nodesep ?? 80;
  const defaultNodeWidth = options.nodeWidth ?? 350;
  const defaultNodeHeight = options.nodeHeight ?? 200;

  const topLevelNodes = graph.nodes.filter(n => !n.parentNode);
  const topLevelIds = new Set(topLevelNodes.map(n => n.id));

  // 1. Group children by parent
  const childrenByParent = new Map<string, typeof graph.nodes>();
  for (const node of graph.nodes) {
    if (node.parentNode) {
      if (!childrenByParent.has(node.parentNode)) {
        childrenByParent.set(node.parentNode, []);
      }
      childrenByParent.get(node.parentNode)!.push(node);
    }
  }

  // Helper to calculate required height for a parent (including children stacking)
  const getRequiredHeight = (node: ArchNode) => {
    const children = childrenByParent.get(node.id) || [];
    const propCount = node.metadata?.properties?.length || 0;
    const methodCount = node.metadata?.methods?.length || 0;
    const baseHeight = Math.max(
      defaultNodeHeight,
      90 + (propCount + methodCount) * 22
    );
    return Math.max(baseHeight, 100 + (children.length * 60));
  };

  // 2. Identify which top-level nodes are connected vs isolated
  const connectedNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
  }

  const connectedTopNodes = topLevelNodes.filter(n => connectedNodeIds.has(n.id));
  const isolatedTopNodes = topLevelNodes.filter(n => !connectedNodeIds.has(n.id));

  const tempPositions = new Map<string, { x: number; y: number }>();
  const parentHeights = new Map<string, number>();

  let maxLayoutX = 0;
  let maxLayoutY = 0;

  // 3. Lay out connected top-level nodes using Dagre
  if (connectedTopNodes.length > 0) {
    const g = new dagre.graphlib.Graph({ compound: true });
    g.setGraph({
      rankdir: options.direction || 'BT',
      ranksep,
      nodesep,
      edgesep: 100,
      marginx: 40,
      marginy: 40,
      align: 'UL',
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of connectedTopNodes) {
      const h = getRequiredHeight(node);
      parentHeights.set(node.id, h);
      g.setNode(node.id, {
        label: node.label,
        width: defaultNodeWidth,
        height: h,
      });
    }

    for (const edge of graph.edges) {
      if (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(g);

    for (const node of connectedTopNodes) {
      const pos = g.node(node.id);
      const h = parentHeights.get(node.id) || defaultNodeHeight;
      const x = pos.x - defaultNodeWidth / 2;
      const y = pos.y - h / 2;
      tempPositions.set(node.id, { x, y });

      maxLayoutX = Math.max(maxLayoutX, x + defaultNodeWidth);
      maxLayoutY = Math.max(maxLayoutY, y + h);
    }
  }

  // 4. Lay out isolated nodes in a multi-column grid
  if (isolatedTopNodes.length > 0) {
    const startX = 40;
    // Position isolated grid below the connected graph (if any) or at (40, 40)
    const startY = connectedTopNodes.length > 0 ? maxLayoutY + 120 : 40;

    const columnsCount = 3;
    const colGap = 80;
    const rowGap = 80;

    // Track the height of each row in the grid
    const rowHeights: number[] = [];
    for (let i = 0; i < isolatedTopNodes.length; i++) {
      const node = isolatedTopNodes[i]!;
      const row = Math.floor(i / columnsCount);
      const h = getRequiredHeight(node);
      if (rowHeights[row] === undefined || h > rowHeights[row]!) {
        rowHeights[row] = h;
      }
    }

    // Position each isolated node
    for (let i = 0; i < isolatedTopNodes.length; i++) {
      const node = isolatedTopNodes[i]!;
      const col = i % columnsCount;
      const row = Math.floor(i / columnsCount);

      let y = startY;
      for (let r = 0; r < row; r++) {
        y += (rowHeights[r] ?? defaultNodeHeight) + rowGap;
      }

      const x = startX + col * (defaultNodeWidth + colGap);
      const h = getRequiredHeight(node);
      parentHeights.set(node.id, h);
      tempPositions.set(node.id, { x, y });
    }
  }

  // 5. Build positioned nodes array
  const positionedNodes: PositionedNode[] = [];
  for (const node of topLevelNodes) {
    const pos = tempPositions.get(node.id) || { x: 0, y: 0 };
    const h = parentHeights.get(node.id) || getRequiredHeight(node);

    positionedNodes.push({
      ...node,
      x: pos.x,
      y: pos.y,
      width: defaultNodeWidth,
      height: h,
      style: {
        ...node.style,
        width: defaultNodeWidth,
        height: h,
      },
    });
  }

  // 6. Assign relative coordinates to children
  for (const [parentId, children] of childrenByParent.entries()) {
    let currentY = 80; // Start below the header
    for (const child of children) {
      positionedNodes.push({
        ...child,
        x: 20, // Indent inside parent
        y: currentY,
        width: defaultNodeWidth - 40,
        height: 40,
      });
      currentY += 60;
    }
  }

  return {
    ...graph,
    nodes: positionedNodes,
  };
}
