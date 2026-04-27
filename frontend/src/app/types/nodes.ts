import { Node } from "@xyflow/react";

export interface CustomNodeData {
  label: string;
  filePath: string;
  metadata?: {
    properties?: string[];
    methods?: string[];
    lineCount?: number;
    exportCount?: number;
    maxComplexity?: number;
  };
  analysis?: {
    isGodObject?: boolean;
    isDeadCode?: boolean;
    isEntryPoint?: boolean;
  };
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
