// ============================================================
//  Atlas-TS — Shared Types
//  Used by both backend and frontend
// ============================================================

// --- Parser Types ---
export type EntityKind = "class" | "interface" | "function" | "file" | "database" | "group";

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
  complexity: number;
}

export interface ParsedClass {
  kind: "class";
  name: string;
  isExported: boolean;
  isAbstract: boolean;
  properties: ParsedProperty[];
  methods: ParsedMethod[];
  extends?: string | undefined;
  implements: string[];
  decorators: string[];
  lineCount: number;
}

export interface ParsedInterface {
  kind: "interface";
  name: string;
  isExported: boolean;
  properties: ParsedProperty[];
  methods: ParsedMethod[];
  extends: string[];
  lineCount: number;
}

export interface ParsedFunction {
  kind: "function";
  name: string;
  isExported: boolean;
  parameters: ParsedParameter[];
  returnType: string;
  lineCount: number;
  complexity: number;
}

export interface ParsedDatabase {
  kind: "database";
  name: string;
  columns: ParsedProperty[];
  lineCount: number;
}

export interface ParsedImport {
  kind: "import";
  moduleSpecifier: string;
  resolvedPath?: string | undefined;
  defaultImport?: string | undefined;
  namedImports: string[];
  namespaceImport?: string | undefined;
}

export interface ParsedFile {
  kind: "file";
  name: string;
  filePath: string;
  imports: ParsedImport[];
  classes: ParsedClass[];
  interfaces: ParsedInterface[];
  functions: ParsedFunction[];
  databaseTables?: ParsedDatabase[];
  lineCount: number;
}

// --- Graph Node ---
export interface ArchNode {
  id: string;
  label: string;
  type: "file" | "class" | "interface" | "function" | "database" | "group";
  filePath: string;
  parentNode?: string;
  metadata: {
    properties?: string[];
    methods?: string[];
    lineCount: number;
    exportCount: number;
    maxComplexity: number;
  };
  position: { x: number; y: number };
  style?: Record<string, any>; // Used by React Flow for size overrides
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
