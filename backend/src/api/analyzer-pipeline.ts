import path from 'path';
import { analyzeWithLsp, clearFileCache } from '../lsp/index.js';
import { parseDatabaseSchemas } from '../parser/project-parser.js';
import { buildGraph, findImportedEntityIds } from '../graph/graph-builder.js';
import { computeLayout } from '../graph/layout.js';
import { detectGodObjects } from '../analyzers/god-object.js';
import { detectDeadCode } from '../analyzers/dead-code.js';
import { detectCycles } from '../graph/algorithms/cycle-detection.js';
import { detectPatterns } from '../analyzers/patterns/index.js';
import { detectAllEntryPoints } from '../parser/entry-point.js';
import type { ParsedFile, AnalysisResponse, WireNode, WireEdge } from 'shared';

/**
 * Shared downstream pipeline: graph building → analysis → layout → serialize.
 *
 * The return type is the shared `AnalysisResponse` wire contract, so any field
 * the frontend expects but the pipeline forgets to emit is a compile error.
 */
export function runGraphPipeline(
  parsedFiles: ParsedFile[],
  detectedEntryPoints: ReturnType<typeof detectAllEntryPoints>,
): AnalysisResponse {
  // Entry points often name compiled output ("node dist/server.js"), which is
  // never parsed. Point them at the source file that produces it.
  const parsedPaths = parsedFiles.map((f) => f.filePath);
  const entryPoints = detectedEntryPoints.map((ep) => ({
    ...ep,
    entryFile: mapEntryToSource(ep.entryFile, parsedPaths) ?? ep.entryFile,
  }));

  // 3. Build the architecture graph
  const entryFileList = entryPoints.map(ep => ep.entryFile);
  const graph = buildGraph(parsedFiles, entryFileList.length > 0 ? entryFileList : undefined);

  // 4. Run god-object detection and populate analysis
  const godObjectHits = detectGodObjects(graph);
  graph.analysis.godObjects = godObjectHits.map((h) => h.nodeId);

  // 5. Run dead-code detection and populate analysis. The detected entry
  // points and imported-by-name entities are not dead even with no edges in.
  const deadCodeHits = detectDeadCode(
    graph,
    entryFileList.map((f) => `file:${f}`),
    findImportedEntityIds(parsedFiles),
  );
  graph.analysis.deadCode = deadCodeHits.map((h) => h.nodeId);

  // 6. Run cycle detection
  graph.analysis.cycles = detectCycles(graph);

  // 7. Run design pattern detection
  graph.analysis.patterns = detectPatterns(graph);

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
  };
}

/** Directories that hold build output rather than source. */
const OUTPUT_DIRS = new Set(['dist', 'build', 'out', 'lib', '.next']);

/**
 * Map an entry file to a parsed source file.
 *
 * Returns `entryFile` itself when it was parsed. For a compiled path such as
 * `dist/backend/src/server.js`, returns the parsed file with the longest
 * matching path suffix ignoring extensions (`src/server.ts`). Returns null
 * when nothing matches.
 */
export function mapEntryToSource(entryFile: string, parsedPaths: string[]): string | null {
  if (parsedPaths.includes(entryFile)) return entryFile;

  const firstSegment = entryFile.split('/')[0] ?? '';
  if (!OUTPUT_DIRS.has(firstSegment)) return null;

  const stripExt = (p: string) => p.replace(/\.[^./]+$/, '');
  const entryStem = stripExt(entryFile);

  let best: string | null = null;
  for (const candidate of parsedPaths) {
    const stem = stripExt(candidate);
    if (entryStem.endsWith('/' + stem) && (!best || stem.length > stripExt(best).length)) {
      best = candidate;
    }
  }
  return best;
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
  return runGraphPipeline(parsedFiles, entryPoints);
}
