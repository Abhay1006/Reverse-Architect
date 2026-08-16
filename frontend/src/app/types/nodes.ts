import { Node } from "@xyflow/react";
import type { WireNodeMetadata, WireNodeAnalysis } from "shared";

/**
 * Node payload as stored in the canvas. `metadata` and `analysis` come
 * straight off the wire (see shared/types.ts) — they are always populated by
 * the backend, so components can read them without casts.
 *
 * The index signature is required by React Flow's `Node<T>` constraint.
 */
export interface CustomNodeData {
  label: string;
  filePath: string;
  metadata: WireNodeMetadata;
  analysis: WireNodeAnalysis;
  [key: string]: unknown;
}

// Define specific node types for XYFlow v12+
export type ClassNode = Node<CustomNodeData, "class">;
export type InterfaceNode = Node<CustomNodeData, "interface">;
export type FunctionNode = Node<CustomNodeData, "function">;
export type FileNode = Node<CustomNodeData, "file">;
export type GroupNode = Node<CustomNodeData, "group">;
export type DatabaseNodeType = Node<CustomNodeData, "database">;

// Union type for all Atlas nodes
export type AtlasNode = ClassNode | InterfaceNode | FunctionNode | FileNode | DatabaseNodeType | GroupNode;
