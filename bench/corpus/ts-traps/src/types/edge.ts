import type { GraphNode } from './node';

export interface GraphEdge {
  from: GraphNode;
  to: GraphNode;
}
