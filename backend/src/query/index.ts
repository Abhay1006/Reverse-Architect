// ============================================================
//  Atlas — Query Layer
//  Read-only questions over a finished analysis. The CLI and the
//  MCP server are thin adapters over these functions, so both
//  answer the same question the same way.
//
//  Every list is bounded and paged: callers (often an agent with a
//  limited context window) ask for more rather than receive it all.
// ============================================================

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  AnalysisResponse,
  Confidence,
  Finding,
  FindingKind,
  WireEdge,
  WireNode,
} from 'shared';
import { analyzeProjectDir } from '../api/analyzer-pipeline.js';
import { resolveWithinRoot } from '../api/path-safety.js';
import { cloneRepo, parseGithubUrl } from '../github/clone.js';

export const FINDING_KINDS: readonly FindingKind[] = ['cycle', 'hotspot', 'god-object', 'dead-code', 'pattern'];
export const CONFIDENCE_LEVELS: readonly Confidence[] = ['high', 'medium', 'low'];

/** Hard ceilings, whatever the caller asks for. */
const MAX_PAGE_SIZE = 200;
export const MAX_SOURCE_LINES = 400;

// ---------------------------------------------------------------------------
//  Loading
// ---------------------------------------------------------------------------

export interface LoadedAnalysis {
  /** What the caller asked for: a path or a GitHub URL. */
  target: string;
  /** Directory the analysis ran on; source reads are confined to it. */
  root: string;
  result: AnalysisResponse;
  /** Removes a temporary clone, if one was made. Safe to call twice. */
  dispose: () => void;
}

/**
 * Analyze a local directory or a public GitHub repository URL.
 * A GitHub target is shallow-cloned into a temporary directory that lives
 * until `dispose()` so source can still be read afterwards.
 */
export async function analyzeTarget(target: string): Promise<LoadedAnalysis> {
  const github = parseGithubUrl(target);
  if (github) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reverse-architect-'));
    const root = path.join(dir, 'repo');
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      fs.rmSync(dir, { recursive: true, force: true });
    };
    try {
      await cloneRepo(github.url, root);
      return { target, root, result: await analyzeProjectDir(root), dispose };
    } catch (err) {
      dispose();
      throw err;
    }
  }

  if (/^[a-z]+:\/\//i.test(target)) {
    throw new Error('Only https://github.com/<owner>/<repo> URLs are supported. For anything else, clone it and pass the directory.');
  }
  const root = path.resolve(target);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  return { target, root, result: await analyzeProjectDir(root), dispose: () => {} };
}

// ---------------------------------------------------------------------------
//  Shapes returned to callers
// ---------------------------------------------------------------------------

export interface NodeRef {
  id: string;
  label: string;
  type: string;
  filePath: string;
}

export interface Page<T> {
  total: number;
  offset: number;
  items: T[];
  /** Pass as `offset` to get the next page; null when this is the last. */
  nextOffset: number | null;
}

function page<T>(all: T[], offset = 0, limit = 20): Page<T> {
  const size = Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE);
  const start = Math.max(0, Math.floor(offset));
  const items = all.slice(start, start + size);
  const next = start + items.length;
  return { total: all.length, offset: start, items, nextOffset: next < all.length ? next : null };
}

function toRef(n: WireNode): NodeRef {
  return { id: n.id, label: n.data.label, type: n.type, filePath: n.data.filePath };
}

/** Layout-only container nodes carry no architecture of their own. */
function realNodes(result: AnalysisResponse): WireNode[] {
  return result.nodes.filter(n => n.type !== 'group');
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

// ---------------------------------------------------------------------------
//  Overview
// ---------------------------------------------------------------------------

export interface FindingHeadline {
  id: string;
  kind: FindingKind;
  confidence: Confidence;
  title: string;
}

export interface Overview {
  target: string;
  entryPoint: AnalysisResponse['entryPoint'];
  nodesByType: Record<string, number>;
  edgesByRelation: Record<string, number>;
  coverage: AnalysisResponse['coverage'];
  /** findingCounts[kind][confidence] */
  findingCounts: Record<string, Record<string, number>>;
  topFindings: FindingHeadline[];
}

function headline(f: Finding): FindingHeadline {
  return { id: f.id, kind: f.kind, confidence: f.confidence, title: f.title };
}

/** A compact picture of the whole analysis: sized to read before anything else. */
export function overview(loaded: Pick<LoadedAnalysis, 'target' | 'result'>, top = 10): Overview {
  const { result } = loaded;
  const findingCounts: Record<string, Record<string, number>> = {};
  for (const f of result.findings) {
    const byConfidence = (findingCounts[f.kind] ??= {});
    byConfidence[f.confidence] = (byConfidence[f.confidence] ?? 0) + 1;
  }
  return {
    target: loaded.target,
    entryPoint: result.entryPoint,
    nodesByType: countBy(realNodes(result), n => n.type),
    edgesByRelation: countBy(result.edges, e => e.relation),
    coverage: result.coverage,
    findingCounts,
    // Low-confidence findings are mostly noise for a first look.
    topFindings: result.findings.filter(f => f.confidence !== 'low').slice(0, top).map(headline),
  };
}

// ---------------------------------------------------------------------------
//  Findings
// ---------------------------------------------------------------------------

export interface FindingFilter {
  kind?: FindingKind | undefined;
  minConfidence?: Confidence | undefined;
  /** Only findings touching this file path (exact, or a directory prefix ending in `/`). */
  path?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}

export function listFindings(result: AnalysisResponse, filter: FindingFilter = {}): Page<Finding> {
  const maxRank = CONFIDENCE_LEVELS.indexOf(filter.minConfidence ?? 'low');
  const nodes = new Map(result.nodes.map(n => [n.id, n]));
  const touches = (f: Finding, p: string) =>
    f.nodeIds.some(id => {
      const fp = nodes.get(id)?.data.filePath ?? '';
      return p.endsWith('/') ? fp.startsWith(p) : fp === p;
    }) || f.evidence.some(e => e.location?.filePath === p || (p.endsWith('/') && e.location?.filePath.startsWith(p)));

  const matched = result.findings.filter(f =>
    (!filter.kind || f.kind === filter.kind) &&
    CONFIDENCE_LEVELS.indexOf(f.confidence) <= maxRank &&
    (!filter.path || touches(f, filter.path)));
  return page(matched, filter.offset, filter.limit);
}

export function getFinding(result: AnalysisResponse, id: string): Finding | null {
  return result.findings.find(f => f.id === id) ?? null;
}

// ---------------------------------------------------------------------------
//  Nodes: lookup, search, neighbours
// ---------------------------------------------------------------------------

export type Resolution =
  | { status: 'found'; node: NodeRef }
  | { status: 'ambiguous'; candidates: NodeRef[] }
  | { status: 'not-found' };

/**
 * Resolve what a caller means by `ref`: a node id, a file path, or a symbol
 * name. Ambiguous names return the candidates instead of guessing.
 */
export function resolveNode(result: AnalysisResponse, ref: string): Resolution {
  const nodes = realNodes(result);
  const byId = nodes.find(n => n.id === ref);
  if (byId) return { status: 'found', node: toRef(byId) };

  const normalized = ref.replace(/\\/g, '/').replace(/^\.\//, '');
  const file = nodes.find(n => n.type === 'file' && n.data.filePath === normalized);
  if (file) return { status: 'found', node: toRef(file) };

  const named = nodes.filter(n => n.data.label === ref);
  const candidates = named.length > 0 ? named : nodes.filter(n => n.data.label.toLowerCase() === ref.toLowerCase());
  if (candidates.length === 1) return { status: 'found', node: toRef(candidates[0]!) };
  if (candidates.length > 1) return { status: 'ambiguous', candidates: candidates.slice(0, 20).map(toRef) };
  return { status: 'not-found' };
}

export interface SearchHit extends NodeRef {
  /** 0 exact, 1 prefix, 2 substring, 3 path match. Lower is better. */
  rank: number;
}

export function searchSymbols(
  result: AnalysisResponse,
  query: string,
  opts: { type?: string | undefined; offset?: number | undefined; limit?: number | undefined } = {},
): Page<SearchHit> {
  const q = query.trim().toLowerCase();
  if (!q) return page([], 0, opts.limit);
  const hits: SearchHit[] = [];
  for (const n of realNodes(result)) {
    if (opts.type && n.type !== opts.type) continue;
    const label = n.data.label.toLowerCase();
    const rank = label === q ? 0
      : label.startsWith(q) ? 1
      : label.includes(q) ? 2
      : n.data.filePath.toLowerCase().includes(q) ? 3
      : -1;
    if (rank >= 0) hits.push({ ...toRef(n), rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.label.length - b.label.length || a.id.localeCompare(b.id));
  return page(hits, opts.offset, opts.limit);
}

export interface Neighbour extends NodeRef {
  relation: WireEdge['relation'];
  /** Hops from the starting node. */
  depth: number;
}

/**
 * Walk the graph from `nodeId`. `dependents` follows edges backwards (who
 * relies on this?), `dependencies` forwards (what does this rely on?).
 */
export function neighbours(
  result: AnalysisResponse,
  nodeId: string,
  direction: 'dependents' | 'dependencies',
  opts: { depth?: number | undefined; offset?: number | undefined; limit?: number | undefined } = {},
): Page<Neighbour> {
  const maxDepth = Math.min(Math.max(1, opts.depth ?? 1), 5);
  const nodes = new Map(result.nodes.map(n => [n.id, n]));
  const adjacency = new Map<string, WireEdge[]>();
  for (const e of result.edges) {
    const key = direction === 'dependents' ? e.target : e.source;
    const list = adjacency.get(key) ?? [];
    list.push(e);
    adjacency.set(key, list);
  }

  const seen = new Set([nodeId]);
  const out: Neighbour[] = [];
  let frontier = [nodeId];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adjacency.get(id) ?? []) {
        const otherId = direction === 'dependents' ? e.source : e.target;
        if (seen.has(otherId)) continue;
        seen.add(otherId);
        const other = nodes.get(otherId);
        if (!other) continue;
        out.push({ ...toRef(other), relation: e.relation, depth });
        next.push(otherId);
      }
    }
    frontier = next;
  }
  return page(out, opts.offset, opts.limit);
}

// ---------------------------------------------------------------------------
//  Source
// ---------------------------------------------------------------------------

export interface SourceExcerpt {
  filePath: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
  /** Lines prefixed with their 1-based number. */
  text: string;
}

/**
 * Read lines of a file inside the analysed root. Symlinks and `..` that
 * escape the root are refused — a cloned repository is untrusted content.
 */
export function readSource(root: string, filePath: string, startLine = 1, endLine?: number): SourceExcerpt {
  const resolved = resolveWithinRoot(root, filePath);
  if (!resolved || !fs.statSync(resolved).isFile()) {
    throw new Error(`File not found inside the analysed project: ${filePath}`);
  }
  const lines = fs.readFileSync(resolved, 'utf-8').split(/\r?\n/);
  const start = Math.min(Math.max(1, Math.floor(startLine)), Math.max(1, lines.length));
  const requestedEnd = Math.min(endLine ?? lines.length, lines.length);
  const end = Math.max(start, Math.min(requestedEnd, start + MAX_SOURCE_LINES - 1));
  const width = String(end).length;
  const text = lines.slice(start - 1, end).map((l, i) => `${String(start + i).padStart(width)}  ${l}`).join('\n');
  return { filePath, startLine: start, endLine: end, totalLines: lines.length, truncated: end < requestedEnd, text };
}

// ---------------------------------------------------------------------------
//  Export
// ---------------------------------------------------------------------------

/**
 * File-level dependency diagram as a Mermaid flowchart. Large graphs are cut
 * to the `maxNodes` most-connected files, and the diagram says so.
 */
export function toMermaid(result: AnalysisResponse, maxNodes = 60): string {
  const files = result.nodes.filter(n => n.type === 'file');
  const fileIds = new Set(files.map(n => n.id));
  const edges = result.edges.filter(e => fileIds.has(e.source) && fileIds.has(e.target) && e.source !== e.target);

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const kept = files
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, maxNodes));
  const keptIds = new Map(kept.map((n, i) => [n.id, `n${i}`]));

  const lines = ['flowchart LR'];
  if (kept.length < files.length) {
    lines.push(`  %% Showing the ${kept.length} most-connected of ${files.length} files.`);
  }
  for (const n of kept) {
    lines.push(`  ${keptIds.get(n.id)}["${n.data.filePath.replace(/"/g, '#quot;')}"]`);
  }
  const seen = new Set<string>();
  for (const e of edges) {
    const a = keptIds.get(e.source);
    const b = keptIds.get(e.target);
    if (!a || !b) continue;
    const key = `${a}>${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(e.relation === 'import' ? `  ${a} --> ${b}` : `  ${a} -.->|${e.relation}| ${b}`);
  }
  return lines.join('\n') + '\n';
}
