// ============================================================
//  Atlas — Shared Types
//  Used by both backend and frontend
//  🔄 Extended with optional LSP-enhanced fields
// ============================================================

// --- Parser Types ---
export type EntityKind = "class" | "interface" | "function" | "file" | "database" | "group";

/** LSP: precise source range for a symbol */
export interface SourceRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

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
  calledFunctions?: string[];
  /** Position of the symbol's name (0-based), as reported by the language server. */
  namePosition?: { line: number; character: number };
  /** LSP: precise position range of this method in the source file */
  range?: SourceRange;
  /** LSP: fully qualified type signature from hover */
  typeSignature?: string;
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
  /** LSP: source range of the class declaration */
  range?: SourceRange;
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
  calledFunctions?: string[];
  /** Position of the symbol's name (0-based), as reported by the language server. */
  namePosition?: { line: number; character: number };
  /** LSP: source range of the function declaration */
  range?: SourceRange;
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
  /** `export * from '...'` / `export { a } from '...'` rather than an import. */
  isReExport?: boolean;
  /** LSP: the URI that definition resolved to */
  definitionUri?: string;
  /** `import type …`: erased at compile time, no runtime dependency. */
  typeOnly?: boolean;
  /** `import('…')`: loaded lazily at runtime. */
  dynamic?: boolean;
}

/**
 * Which extractor produced a ParsedFile. Reported in the analysis coverage so
 * consumers can tell resolved (LSP) facts from regex-level approximations.
 */
export type FileAnalyzer = "lsp" | "text" | "schema";

export interface ParsedFile {
  kind: "file";
  name: string;
  filePath: string;
  analyzer?: FileAnalyzer;
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
    entities?: { name: string; type: string }[];
    lineCount: number;
    exportCount: number;
    maxComplexity: number;
    importanceScore?: number;
  };
  /** Source range of the entity, when the extractor reported one. */
  range?: SourceRange;
  position: { x: number; y: number };
  style?: Record<string, any>; // Used by React Flow for size overrides
}

// --- Graph Edge ---
export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: "import" | "extends" | "implements" | "calls";
  /** Import edges only: every import behind this edge is `import type`. */
  typeOnly?: boolean;
}

// --- Analysis Results ---
export interface AnalysisResult {
  godObjects: string[];
  deadCode: string[];
  cycles: string[][];
  patterns: PatternMatch[];
}

export type DesignPattern =
  | "observer" | "singleton" | "factory" | "builder" | "strategy" | "adapter";

export type Confidence = "high" | "medium" | "low";

export interface PatternMatch {
  nodeId: string;
  pattern: DesignPattern;
  confidence: Confidence;
  /** The observations that triggered the match, e.g. `has method "getInstance"`. */
  reasons: string[];
  /** Other nodes taking part in the pattern (e.g. a strategy's implementations). */
  relatedNodeIds?: string[];
}

// ============================================================
//  Findings
//  Every conclusion Atlas draws is reported as a Finding that carries the
//  evidence behind it and what the analysis could not check. A finding is a
//  claim to verify, not a verdict.
// ============================================================

export type FindingKind = "cycle" | "dead-code" | "god-object" | "hotspot" | "pattern";

export interface EvidenceItem {
  /**
   * `observed`: read directly from the parsed source (an import, a method name,
   * a measured number). `inferred`: a conclusion drawn from observations.
   */
  basis: "observed" | "inferred";
  /** Stable rule id, e.g. `dead-code/zero-in-degree`. */
  rule: string;
  detail: string;
  location?: { filePath: string; line?: number };
}

export interface Finding {
  /** Stable across runs on the same code: `<kind>:<subject>`. */
  id: string;
  kind: FindingKind;
  title: string;
  nodeIds: string[];
  confidence: Confidence;
  evidence: EvidenceItem[];
  /** What this finding could not account for. */
  limitations: string[];
}

export interface AnalysisCoverage {
  /** Source files parsed, by extractor. */
  filesByAnalyzer: Record<FileAnalyzer | "unknown", number>;
  filesParsed: number;
  filesInGraph: number;
  /**
   * `entry-points`: only files reachable from detected entry points are in the
   * graph. `all-files`: no entry point was found, so every parsed file is.
   */
  graphScope: "entry-points" | "all-files";
  entryFiles: string[];
  /** Run-wide caveats that apply to every finding. */
  limitations: string[];
}

// --- Complete Graph (internal pipeline representation) ---
export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
  analysis: AnalysisResult;
}

// ============================================================
//  API Wire Types
//  The single source of truth for the backend → frontend payload.
//  Both sides import these, so a missing or renamed field is a
//  compile error rather than a silently-undefined value.
// ============================================================

export interface EntryPointResult {
  /** Relative path to the entry file from the project root */
  entryFile: string;
  /** Detected framework or language environment */
  framework:
    | "node" | "nextjs" | "vite" | "express"
    | "python" | "go" | "rust" | "java" | "cpp"
    | "unknown";
  /** The package name from package.json */
  packageName?: string | undefined;
}

export interface GodObjectHit {
  nodeId: string;
  label: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

export interface DeadCodeHit {
  nodeId: string;
  label: string;
  nodeType: string;
  filePath: string;
  outDegree: number;
}

export interface WireNodeMetadata {
  properties?: string[] | undefined;
  methods?: string[] | undefined;
  entities?: { name: string; type: string }[] | undefined;
  lineCount: number;
  exportCount: number;
  maxComplexity: number;
  importanceScore?: number | undefined;
}

export interface WireNodeAnalysis {
  isGodObject: boolean;
  isDeadCode: boolean;
  isEntryPoint: boolean;
}

export interface WireNodeData {
  label: string;
  filePath: string;
  metadata: WireNodeMetadata;
  analysis: WireNodeAnalysis;
}

export interface WireNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  sourcePosition?: string;
  targetPosition?: string;
  width?: number;
  height?: number;
  parentId?: string;
  extent?: string;
  style?: Record<string, string | number>;
  data: WireNodeData;
}

export interface WireEdge {
  id: string;
  source: string;
  target: string;
  label?: string | undefined;
  /** React Flow edge renderer, e.g. "smoothstep". Not the semantic type. */
  type: string;
  /**
   * The architectural relationship this edge represents.
   * Kept separate from `type` because that field is consumed by React Flow as
   * a renderer name — overwriting it used to discard the semantics entirely,
   * so anything filtering on "import"/"extends" silently matched nothing.
   */
  relation: ArchEdge['type'];
}

/**
 * The exact JSON body returned by POST /api/analyze/upload,
 * POST /api/analyze/github and GET /api/analyze/github/cached.
 */
export interface AnalysisResponse {
  nodes: WireNode[];
  edges: WireEdge[];
  analysis: AnalysisResult;
  godObjectDetails: GodObjectHit[];
  deadCodeDetails: DeadCodeHit[];
  entryPoint: EntryPointResult | null;
  findings: Finding[];
  coverage: AnalysisCoverage;
  /** Bumped whenever the analysis output changes; stale cache entries are ignored. */
  analyzerVersion: number;
  /** Set by the route handler, not the pipeline. */
  repoId?: string;
}
