// ============================================================
//  Atlas — Findings
//  Turns raw analyzer output into Findings: each conclusion with
//  the observations behind it and the limits of what was checked.
//  This is the single place analyzer results are interpreted for
//  consumers (web UI, CLI, MCP), so they all report the same thing.
// ============================================================

import type {
  AnalysisCoverage,
  ArchGraph,
  ArchNode,
  Confidence,
  DeadCodeHit,
  EvidenceItem,
  FileAnalyzer,
  Finding,
  FindingKind,
  GodObjectHit,
  ParsedFile,
  PatternMatch,
} from 'shared';
import type { HotspotHit } from './hotspots.js';
import { MIN_GOD_OBJECT_DEGREE } from './god-object.js';

/** Tests, tooling, docs and examples: never reachable from the app's entry points, by design. */
const NON_RUNTIME_FILE = new RegExp([
  // directories: test/, tests/, test-d/, __tests__/, examples/, docs/ …
  String.raw`(^|/)(tests?(-\w+)?|__tests__|__mocks__|spec|e2e|fixtures?|scripts?|examples?|samples?|demos?|benchmarks?|sandbox|docs?)/`,
  // files: *.test.ts, *.stories.tsx, *.d.ts, *.config.js, gulpfile.js …
  String.raw`\.(test|spec|stories|config|d)\.[cm]?[jt]sx?$`,
  String.raw`(^|/)[^/]*\.config\.\w+$`,
  String.raw`(^|/)(gulpfile|gruntfile|jakefile)\.[cm]?[jt]s$`,
].join('|'), 'i');

const KIND_ORDER: FindingKind[] = ['cycle', 'hotspot', 'god-object', 'dead-code', 'pattern'];
const CONFIDENCE_ORDER: Confidence[] = ['high', 'medium', 'low'];

/** Loaded implicitly by the runtime, so never imported by path. */
const IMPLICITLY_LOADED = /(^|\/)__init__\.py$/;

export function isNonRuntimeFile(filePath: string): boolean {
  return NON_RUNTIME_FILE.test(filePath);
}

function locate(node: ArchNode | undefined): EvidenceItem['location'] {
  if (!node) return undefined;
  return node.range ? { filePath: node.filePath, line: node.range.startLine } : { filePath: node.filePath };
}

function withLocation(item: Omit<EvidenceItem, 'location'>, node: ArchNode | undefined): EvidenceItem {
  const location = locate(node);
  return location ? { ...item, location } : item;
}

// ---------------------------------------------------------------------------
//  Coverage
// ---------------------------------------------------------------------------

/**
 * @param reachability Set when the detected entry points reached too little
 *        of the code and the graph was rebuilt from every file instead.
 * @param manifestFiles Files a package.json points at: in use by definition.
 */
export function computeCoverage(
  parsedFiles: ParsedFile[],
  graph: ArchGraph,
  entryFiles: string[],
  reachability?: { reached: number; total: number },
  manifestFiles: string[] = [],
): { coverage: AnalysisCoverage; unreachableFiles: string[] } {
  const filesByAnalyzer: Record<FileAnalyzer | 'unknown', number> = { lsp: 0, text: 0, schema: 0, unknown: 0 };
  for (const f of parsedFiles) filesByAnalyzer[f.analyzer ?? 'unknown']++;

  const parsedPaths = new Set(parsedFiles.map(f => f.filePath));
  const validEntries = entryFiles.filter(f => parsedPaths.has(f));
  const graphScope = validEntries.length > 0 && !reachability ? 'entry-points' : 'all-files';
  const inGraph = new Set(graph.nodes.filter(n => n.type === 'file').map(n => n.filePath));
  const outside = [...parsedPaths].filter(p => !inGraph.has(p)).sort();
  const fromManifest = new Set(manifestFiles);
  const unreachableFiles = outside.filter(p => !isNonRuntimeFile(p) && !IMPLICITLY_LOADED.test(p) && !fromManifest.has(p));

  const limitations: string[] = [];
  if (filesByAnalyzer.text > 0) {
    limitations.push(
      `${filesByAnalyzer.text} file(s) were parsed with the regex text extractor (non-JS/TS languages): ` +
      'their imports and calls are matched by name, not resolved by a compiler, and carry no line numbers.',
    );
  }
  if (graphScope === 'entry-points') {
    limitations.push(
      `The graph contains only files reachable by import from ${validEntries.join(', ')}. ` +
      `${outside.length} parsed file(s) are outside it` +
      (outside.length > unreachableFiles.length
        ? ` (${outside.length - unreachableFiles.length} of them tests, scripts, config or package markers, which are expected to be)`
        : '') +
      '; cycles and coupling are not measured for those files.',
    );
  } else if (reachability) {
    limitations.push(
      `The detected entry point(s) ${validEntries.join(', ')} reach only ${reachability.reached} of ${reachability.total} ` +
      'source files, too few to trust, so every parsed file is in the graph and unreachable files are not reported.',
    );
  } else {
    limitations.push(
      (entryFiles.length > 0
        ? `The detected entry point(s) ${entryFiles.join(', ')} are not among the parsed source files (often a build output), so`
        : 'No entry point was detected, so') +
      ' every parsed file is in the graph and none can be ruled unreachable.',
    );
  }
  limitations.push(
    'Dynamic imports, framework conventions (file-based routes, dependency injection, reflection) and consumers ' +
    'outside the repository are invisible to static import analysis.',
    'Complexity is estimated by counting decision keywords, not computed from a control-flow graph.',
  );

  return {
    coverage: {
      filesByAnalyzer,
      filesParsed: parsedFiles.length,
      filesInGraph: inGraph.size,
      graphScope,
      entryFiles: validEntries,
      limitations,
    },
    unreachableFiles,
  };
}

// ---------------------------------------------------------------------------
//  Per-kind builders
// ---------------------------------------------------------------------------

/** Module systems where calling into another file requires importing it. */
const FILE_IMPORT_LANGUAGE = /\.[cm]?[jt]sx?$/;

function cycleFindings(cycles: string[][], graph: ArchGraph, nodes: Map<string, ArchNode>, typeLevel = false): Finding[] {
  // File pairs joined by a real import, to tell a resolved call from a
  // name collision (a "call" into a file the caller never imports).
  const importedFiles = new Set<string>();
  for (const e of graph.edges) {
    if (e.type !== 'import') continue;
    const from = nodes.get(e.source)?.filePath;
    const to = nodes.get(e.target)?.filePath;
    if (from && to) importedFiles.add(`${from}\u0000${to}`);
  }
  const edgeBetween = new Map<string, ArchGraph['edges'][number]>();
  for (const e of graph.edges) {
    const key = `${e.source}\u0000${e.target}`;
    // Several relations can link the same pair; the runtime one decides.
    const prev = edgeBetween.get(key);
    if (!prev || (prev.typeOnly && !e.typeOnly)) edgeBetween.set(key, e);
  }

  return cycles.map(cycle => {
    const labels = cycle.map(id => nodes.get(id)?.filePath ?? id);
    const evidence: EvidenceItem[] = [];
    let onlyImports = true;
    let typeOnlyEdges = 0;
    const unbackedCalls: string[] = [];
    cycle.forEach((from, i) => {
      const to = cycle[(i + 1) % cycle.length]!;
      const edge = edgeBetween.get(`${from}\u0000${to}`);
      const type = edge?.type ?? 'unknown';
      if (type !== 'import') onlyImports = false;
      if (edge?.typeOnly) typeOnlyEdges++;
      const a = nodes.get(from);
      const b = nodes.get(to);
      if (type === 'calls' && a && b && a.filePath !== b.filePath && FILE_IMPORT_LANGUAGE.test(a.filePath) &&
          !importedFiles.has(`${a.filePath}\u0000${b.filePath}`)) {
        unbackedCalls.push(`${a.label} → ${b.label}`);
      }
      const verb = type === 'import' ? (edge?.typeOnly ? 'imports only types from' : 'imports') : type;
      evidence.push(withLocation({
        basis: 'observed',
        rule: `cycle/${type}-edge`,
        detail: `${a?.label ?? from} ${verb} ${b?.label ?? to}`,
      }, a));
    });
    const limitations: string[] = [];
    if (typeLevel || typeOnlyEdges > 0) {
      limitations.push(
        `${typeOnlyEdges === cycle.length ? 'Every' : `${typeOnlyEdges} of ${cycle.length}`} link(s) are \`import type\`, ` +
        'which is erased at compile time: this cycle exists in the type graph only and has no runtime effect.',
      );
    }
    const sameFile = new Set(cycle.map(id => nodes.get(id)?.filePath)).size === 1;
    if (sameFile) {
      limitations.push('Every member is in one file: this is mutual recursion, not a dependency between modules.');
    } else if (unbackedCalls.length > 0) {
      limitations.push(
        `${unbackedCalls.join(', ')}: the caller never imports the callee's file, so the call was matched by name ` +
        'and is most likely a different function that shares the name.',
      );
    } else if (!onlyImports) {
      limitations.push('Part of this cycle is a call/inheritance edge resolved by name, which can be wrong when names collide.');
    }
    const canonical = [...cycle].sort();
    return {
      id: `cycle:${canonical.join('|')}`,
      kind: 'cycle',
      title: `${typeLevel ? 'Type-level cycle' : 'Circular dependency'}: ${[...labels, labels[0]].join(' → ')}`,
      nodeIds: cycle,
      confidence: typeLevel || sameFile || unbackedCalls.length > 0 ? 'low' : onlyImports ? 'high' : 'medium',
      evidence,
      limitations,
    };
  });
}

function hotspotFindings(hits: HotspotHit[], nodes: Map<string, ArchNode>): Finding[] {
  return hits.map(h => ({
    id: `hotspot:${h.nodeId}`,
    kind: 'hotspot',
    title: `Hotspot: ${h.label} (complexity ${h.complexity}, used by ${h.inDegree})`,
    nodeIds: [h.nodeId],
    confidence: h.complexity >= 20 && h.inDegree >= 3 ? 'high' : 'medium',
    evidence: [
      withLocation({ basis: 'observed', rule: 'hotspot/complexity', detail: `estimated cyclomatic complexity ${h.complexity} over ${h.lineCount} lines` }, nodes.get(h.nodeId)),
      { basis: 'observed', rule: 'hotspot/fan-in', detail: `${h.inDegree} incoming dependency edge(s)` },
      { basis: 'inferred', rule: 'hotspot/score', detail: `risk score ${h.score} = complexity × (1 + fan-in); ranked among the top hotspots` },
    ],
    limitations: ['No version-control history is used, so how often this code changes is unknown.'],
  }));
}

/** Only the most-connected nodes are worth surfacing by default. */
const GOD_OBJECT_TOP_N = 10;

function godObjectFindings(hits: GodObjectHit[], nodes: Map<string, ArchNode>): Finding[] {
  // `hits` arrive sorted by total degree, most connected first.
  return hits.map((h, rank) => ({
    id: `god-object:${h.nodeId}`,
    kind: 'god-object',
    title: `Highly coupled: ${h.label} (${h.totalDegree} connections)`,
    nodeIds: [h.nodeId],
    // Every hit is already an outlier (see detectGodObjects); only the most
    // connected are surfaced by default.
    confidence: rank < GOD_OBJECT_TOP_N ? 'medium' : 'low',
    evidence: [
      withLocation({ basis: 'observed', rule: 'god-object/degree', detail: `${h.inDegree} incoming and ${h.outDegree} outgoing edge(s)` }, nodes.get(h.nodeId)),
      {
        basis: 'inferred',
        rule: 'god-object/outlier',
        detail: `#${rank + 1} most connected; total degree ${h.totalDegree} is more than two standard deviations above ` +
          `the mean for files and classes in this codebase (and above ${MIN_GOD_OBJECT_DEGREE})`,
      },
    ],
    limitations: ['Degree counts dependencies, not responsibilities; shared utilities and type modules are legitimately depended on by many files.'],
  }));
}

function deadCodeFindings(
  hits: DeadCodeHit[],
  unreachableFiles: string[],
  entryFiles: string[],
  nodes: Map<string, ArchNode>,
): Finding[] {
  const fromGraph: Finding[] = hits
    .filter(h => !isNonRuntimeFile(h.filePath))
    .map(h => {
      const isFile = h.nodeType === 'file';
      const limitations = ['Code can be used through dynamic imports, framework conventions or by consumers outside this repository.'];
      if (!isFile) limitations.push('Calls are matched by name within the parsed files; calls through object properties or callbacks may be missed.');
      return {
        id: `dead-code:${h.nodeId}`,
        kind: 'dead-code' as const,
        title: `Possibly unused ${h.nodeType}: ${isFile ? h.filePath : `${h.label} (${h.filePath})`}`,
        nodeIds: [h.nodeId],
        confidence: (isFile ? 'medium' : 'low') as Confidence,
        evidence: [
          withLocation({ basis: 'observed', rule: 'dead-code/zero-in-degree', detail: `no import, call or inheritance edge points at ${h.label}, and no file imports it by name` }, nodes.get(h.nodeId)),
          { basis: 'inferred', rule: 'dead-code/not-entry-point', detail: 'not recognised as an entry point' },
        ],
        limitations,
      };
    });

  const unreachable: Finding[] = unreachableFiles.map(filePath => ({
    id: `dead-code:unreachable:${filePath}`,
    kind: 'dead-code',
    title: `File not reachable from any entry point: ${filePath}`,
    nodeIds: [],
    confidence: 'medium',
    evidence: [
      { basis: 'observed', rule: 'dead-code/unreachable', detail: `no import chain leads here from ${entryFiles.join(', ')}`, location: { filePath } },
    ],
    limitations: ['It may be loaded by a dynamic import, a framework convention, or a separate entry point Atlas did not detect.'],
  }));

  return [...fromGraph, ...unreachable];
}

function patternFindings(matches: PatternMatch[], nodes: Map<string, ArchNode>): Finding[] {
  return matches.map(m => {
    const node = nodes.get(m.nodeId);
    const name = m.pattern[0]!.toUpperCase() + m.pattern.slice(1);
    return {
      id: `pattern:${m.pattern}:${m.nodeId}`,
      kind: 'pattern',
      title: `${name} pattern: ${node?.label ?? m.nodeId}`,
      nodeIds: [m.nodeId, ...(m.relatedNodeIds ?? [])],
      confidence: m.confidence,
      evidence: [
        ...m.reasons.map((detail, i) =>
          i === 0 ? withLocation({ basis: 'observed', rule: `pattern/${m.pattern}`, detail }, node) : { basis: 'observed' as const, rule: `pattern/${m.pattern}`, detail }),
        { basis: 'inferred', rule: `pattern/${m.pattern}`, detail: `these signals match the shape of the ${m.pattern} pattern` },
      ],
      limitations: ['Detected from member names and inheritance only; method bodies are not inspected.'],
    };
  });
}

// ---------------------------------------------------------------------------
//  Assembly
// ---------------------------------------------------------------------------

export interface FindingInputs {
  graph: ArchGraph;
  /** Cycles that exist at runtime (no `import type` links). */
  cycles: string[][];
  /** Cycles that close only through `import type` links. */
  typeCycles?: string[][];
  hotspots: HotspotHit[];
  godObjects: GodObjectHit[];
  deadCode: DeadCodeHit[];
  unreachableFiles: string[];
  entryFiles: string[];
  patterns: PatternMatch[];
}

/**
 * Builds every finding, ordered by kind, then confidence. The sort is stable,
 * so within a group each builder's own ranking (e.g. hotspot score) survives.
 */
export function buildFindings(input: FindingInputs): Finding[] {
  const nodes = new Map(input.graph.nodes.map(n => [n.id, n]));
  const findings = [
    ...cycleFindings(input.cycles, input.graph, nodes),
    ...cycleFindings(input.typeCycles ?? [], input.graph, nodes, true),
    ...hotspotFindings(input.hotspots, nodes),
    ...godObjectFindings(input.godObjects, nodes),
    ...deadCodeFindings(input.deadCode, input.unreachableFiles, input.entryFiles, nodes),
    ...patternFindings(input.patterns, nodes),
  ];
  return findings.sort((a, b) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    CONFIDENCE_ORDER.indexOf(a.confidence) - CONFIDENCE_ORDER.indexOf(b.confidence));
}
