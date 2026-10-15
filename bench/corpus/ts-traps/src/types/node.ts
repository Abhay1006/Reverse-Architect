import type { GraphEdge } from './edge';

export interface GraphNode {
  id: string;
  edges: GraphEdge[];
}
