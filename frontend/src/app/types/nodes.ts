import { Node } from "@xyflow/react";

export interface CustomNodeData {
  label: string;
  filePath: string;
  metadata?: {
    properties?: string[];
    methods?: string[];
    lineCount?: number;
    exportCount?: number;
  };
  [key: string]: unknown;
}

// Define specific node types for XYFlow v12+
export type ClassNode = Node<CustomNodeData, "class">;
export type InterfaceNode = Node<CustomNodeData, "interface">;
export type FunctionNode = Node<CustomNodeData, "function">;
export type FileNode = Node<CustomNodeData, "file">;

// Union type for all Atlas nodes
export type AtlasNode = ClassNode | InterfaceNode | FunctionNode | FileNode;
