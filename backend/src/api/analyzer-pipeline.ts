import path from 'path';
import { analyzeWithLsp, clearFileCache } from '../lsp/index.js';
import { parseDatabaseSchemas } from '../parser/project-parser.js';
import { buildGraph } from '../graph/graph-builder.js';
import { computeLayout } from '../graph/layout.js';
import { detectGodObjects } from '../analyzers/god-object.js';
import { detectDeadCode } from '../analyzers/dead-code.js';
import { detectCycles } from '../graph/algorithms/cycle-detection.js';
import { detectPatterns } from '../analyzers/patterns/index.js';
import { detectAllEntryPoints, manifestReferencedFiles } from '../parser/entry-point.js';
import { detectHotspots } from '../analyzers/hotspots.js';
import { buildFindings, computeCoverage, isNonRuntimeFile } from '../analyzers/findings.js';
import { ANALYZER_VERSION } from '../analyzer-version.js';
import type { ParsedFile, AnalysisResponse, WireNode, WireEdge } from 'shared';

/**
 * Shared downstream pipeline: graph building → analysis → layout → serialize.
 *
 * The return type is the shared `AnalysisResponse` wire contract, so any field
 * the frontend expects but the pipeline forgets to emit is a compile error.
 */
/** Below this share of source files reached, entry-point scoping is abandoned. */
const MIN_REACHABLE_SHARE = 0.5;

const cycleKey = (cycle: string[]) => [...cycle].sort().join('|');

export function runGraphPipeline(
  parsedFiles: ParsedFile[],
  entryPoints: ReturnType<typeof detectAllEntryPoints>,
  /** Files a package.json points at; never reported as unused. */
  manifestFiles: string[] = [],
): AnalysisResponse {
  // 3. Build the architecture graph, from the entry points when they reach
  // enough of the code to trust. Entry detection reads package.json, whose
  // `main` often points at build output or a dev server; then the entries
  // reach a sliver of the source and everything else would look unused.
  const entryFileList = entryPoints.map(ep => ep.entryFile);
  let graph = buildGraph(parsedFiles, entryFileList.length > 0 ? entryFileList : undefined);
  let reachability: { reached: number; total: number } | undefined;
  if (entryFileList.length > 0) {
    const runtimeFiles = parsedFiles.filter(f => f.analyzer !== 'schema' && !isNonRuntimeFile(f.filePath)).length;
    const reached = graph.nodes.filter(n => n.type === 'file').length;
    if (reached < MIN_REACHABLE_SHARE * runtimeFiles) {
      reachability = { reached, total: runtimeFiles };
      graph = buildGraph(parsedFiles);
    }
  }

  // 4. Run god-object detection and populate analysis
  const godObjectHits = detectGodObjects(graph);
  graph.analysis.godObjects = godObjectHits.map((h) => h.nodeId);

  // 5. Run dead-code detection and populate analysis
  const deadCodeHits = detectDeadCode(graph, [...entryFileList, ...manifestFiles].map(f => `file:${f}`));
  graph.analysis.deadCode = deadCodeHits.map((h) => h.nodeId);

  // 6. Run cycle detection. A runtime cycle must survive without `import
  // type` links, which compile away; cycles that need them are reported
  // separately (low confidence) rather than as circular dependencies.
  const runtimeCycles = detectCycles({ ...graph, edges: graph.edges.filter(e => !e.typeOnly) });
  const runtimeKeys = new Set(runtimeCycles.map(cycleKey));
  const typeCycles = detectCycles(graph).filter(c => !runtimeKeys.has(cycleKey(c)));
  graph.analysis.cycles = runtimeCycles;

  // 7. Run design pattern detection
  graph.analysis.patterns = detectPatterns(graph);

  // 7b. Hotspots, coverage, and the evidence-backed findings consumers read
  const hotspots = detectHotspots(graph);
  const { coverage, unreachableFiles } = computeCoverage(parsedFiles, graph, entryFileList, reachability, manifestFiles);
  const findings = buildFindings({
    graph,
    cycles: runtimeCycles,
    typeCycles,
    hotspots,
    godObjects: godObjectHits,
    deadCode: deadCodeHits,
    unreachableFiles,
    entryFiles: coverage.entryFiles,
    patterns: graph.analysis.patterns,
  });

  // 8. Compute layout positions
  const direction = 'TB';
  const positioned = computeLayout(graph, {
    direction,
  });

  // Create a quick lookup map for parent resolution
  const posNodeMap = new Map<string, typeof positioned.nodes[0]>();
  for (const n of positioned.nodes) {
    posNodeMap.set(n.id, n);
  }

  // 9. Serialize to React Flow format
  const initialNodes: WireNode[] = positioned.nodes.map((n) => {
    const relativeX = n.x;
    const relativeY = n.y;

    const rfNode: WireNode = {
      id: n.id,
      type: n.type,
      position: { x: relativeX, y: relativeY },
      sourcePosition: direction === 'TB' ? 'bottom' : direction === 'BT' ? 'top' : 'right',
      targetPosition: direction === 'TB' ? 'top' : direction === 'BT' ? 'bottom' : 'left',
      ...(n.width ? { width: n.width } : {}),
      ...(n.height ? { height: n.height } : {}),
      ...(n.parentNode ? { parentId: n.parentNode } : {}),
      data: {
        label: n.label,
        filePath: n.filePath,
        metadata: n.metadata,
        analysis: {
          isGodObject: graph.analysis.godObjects.includes(n.id),
          isDeadCode: graph.analysis.deadCode.includes(n.id),
          isEntryPoint: entryPoints.some(ep => n.filePath === ep.entryFile) && n.type === 'file',
        },
      },
    };
    
    if (n.style) {
      rfNode.style = n.style as Record<string, string | number>;
    }
    
    if (n.parentNode) {
      rfNode.parentId = n.parentNode;
      rfNode.extent = 'parent';
    }

    return rfNode;
  });

  const initialEdges: WireEdge[] = positioned.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    // `type` is the React Flow renderer; `relation` carries the semantics.
    type: 'smoothstep',
    relation: e.type,
  }));

  return {
    nodes: initialNodes,
    edges: initialEdges,
    // Cycles, patterns, god objects and dead code are all computed above —
    // this field is what the frontend reads for every analysis overlay.
    analysis: graph.analysis,
    godObjectDetails: godObjectHits,
    deadCodeDetails: deadCodeHits,
    entryPoint: entryPoints.length > 0 ? entryPoints[0]! : null,
    findings,
    coverage,
    analyzerVersion: ANALYZER_VERSION,
  };
}

/**
 * Core analysis function using the LSP engine (new default).
 * parse project → build graph → layout → serialize.
 * Works on an already-extracted directory path.
 */
export async function analyzeProjectDir(projectPath: string) {
  // Clear the LSP adapter file cache at the start of a fresh run
  clearFileCache();

  // 0. Detect entry points (scanning root and subdirectories)
  const entryPoints = detectAllEntryPoints(projectPath);
  if (entryPoints.length > 0) {
    console.log(`Detected ${entryPoints.length} entry point(s):`);
    for (const ep of entryPoints) {
      console.log(`  - ${ep.entryFile} (${ep.framework})`);
    }
  } else {
    console.log("No entry point detected.");
  }

  // 1. Parse project files using LSP + database schemas
  console.log('🔄 Using LSP engine for analysis...');
  const lspParsedFiles = await analyzeWithLsp(projectPath);
  const dbFiles = parseDatabaseSchemas(projectPath);

  // Helper: convert absolute file paths to paths relative to the project root
  const toRelativePath = (absPath: string) => {
    const rel = path.relative(projectPath, absPath);
    return rel.split(path.sep).join('/');
  };

  // 2. Merge database schema files with LSP-parsed files
  const parsedFiles: ParsedFile[] = [
    ...dbFiles.map(f => ({
      ...f,
      filePath: toRelativePath(f.filePath),
    })),
    ...lspParsedFiles,
  ];

  // 3–8: Downstream pipeline (unchanged — operates on ParsedFile[])
  return runGraphPipeline(parsedFiles, entryPoints, manifestReferencedFiles(projectPath));
}
