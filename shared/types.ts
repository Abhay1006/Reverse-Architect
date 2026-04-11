// ============================================================
//  Atlas-TS — Shared Types
//  Used by both backend and frontend
// ============================================================

// --- Parser Types ---
export type EntityKind = "class" | "interface" | "function" | "file";

export interface ParsedParameter {
  name: string;
  type: string;
}

export interface ParsedProperty {
  name: string;
  type: string;
  visibility: "public" | "protected" | "private" | "unknown";
}

export interface ParsedMethod {
  name: string;
  parameters: ParsedParameter[];
  returnType: string;
  visibility: "public" | "protected" | "private" | "unknown";
}

export interface ParsedClass {
  kind: "class";
  name: string;
  isExported: boolean;
  isAbstract: boolean;
  properties: ParsedProperty[];
  methods: ParsedMethod[];
  extends?: string;
  implements: string[];
  decorators: string[];
}

export interface ParsedInterface {
  kind: "interface";
  name: string;
  // to be expanded later...
}

export interface ParsedFunction {
  kind: "function";
  name: string;
  // to be expanded later...
}

// --- Graph Node ---
export interface ArchNode {
  id: string;
  label: string;
  type: "file" | "class" | "interface" | "function";
  filePath: string;
  metadata: {
    properties?: string[];
    methods?: string[];
    lineCount: number;
    exportCount: number;
  };
  position: { x: number; y: number };
}

// --- Graph Edge ---
export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: "import" | "extends" | "implements";
}

// --- Analysis Results ---
export interface AnalysisResult {
  godObjects: string[];
  deadCode: string[];
  cycles: string[][];
  patterns: PatternMatch[];
}

export interface PatternMatch {
  nodeId: string;
  pattern: "observer" | "singleton" | "factory";
  confidence: "high" | "medium" | "low";
}

// --- Complete Graph (API Response) ---
export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
  analysis: AnalysisResult;
}
