// ============================================================
//  Atlas — MCP Server
//  Exposes the query layer as Model Context Protocol tools so an
//  agent can ask architecture questions about a codebase instead of
//  reading every file. Results are paged and compact by default;
//  every finding carries its evidence and limitations.
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  CONFIDENCE_LEVELS,
  FINDING_KINDS,
  analyzeTarget,
  getFinding,
  listFindings,
  neighbours,
  overview,
  readSource,
  resolveNode,
  searchSymbols,
  toMermaid,
  type LoadedAnalysis,
} from '../query/index.js';
import { PACKAGE_VERSION } from '../package-info.js';

const target = z.string().min(1).describe(
  'Absolute path to a local project directory, or a https://github.com/<owner>/<repo> URL. ' +
  'The first call analyzes it (can take a minute); later calls reuse that analysis.',
);
const offset = z.number().int().min(0).optional().describe('Paging offset; pass the previous nextOffset.');
const limit = (dflt: number) => z.number().int().min(1).max(200).optional().describe(`Page size (default ${dflt}).`);

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function json(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] };
}

function failure(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createAtlasMcpServer(): { server: McpServer; dispose: () => void } {
  const server = new McpServer(
    { name: 'reverse-architect', version: PACKAGE_VERSION },
    {
      instructions:
        'Reverse Architect analyzes a codebase\'s architecture: modules, dependencies, circular imports, ' +
        'hotspots, highly coupled modules, possibly unused code, and design patterns. Start with analyze_project, ' +
        'then drill in with list_findings, search_symbols, trace_dependencies and read_source. Findings are ' +
        'heuristic claims with evidence: check the evidence and limitations before acting on one.',
    },
  );

  // One analysis per target per session; concurrent callers share the promise.
  const sessions = new Map<string, Promise<LoadedAnalysis>>();
  const load = (t: string, refresh = false): Promise<LoadedAnalysis> => {
    const existing = sessions.get(t);
    if (existing && !refresh) return existing;
    void existing?.then(a => a.dispose(), () => {});
    const pending = analyzeTarget(t);
    sessions.set(t, pending);
    pending.catch(() => sessions.delete(t));
    return pending;
  };

  const tool = <T>(run: (args: T) => Promise<CallToolResult>) => async (args: T): Promise<CallToolResult> => {
    try {
      return await run(args);
    } catch (err) {
      return failure(err instanceof Error ? err.message : String(err));
    }
  };

  server.registerTool('analyze_project', {
    title: 'Analyze a project',
    description:
      'Analyze a codebase and return an overview: entry point, node and edge counts, what was analyzed and how ' +
      '(coverage and its limitations), finding counts by kind and confidence, and the top findings.',
    inputSchema: {
      target,
      refresh: z.boolean().optional().describe('Re-analyze even if this session already has a result.'),
    },
    annotations: { ...READ_ONLY, idempotentHint: false, openWorldHint: true },
  }, tool(async ({ target: t, refresh }) => json(overview(await load(t, refresh ?? false)))));

  server.registerTool('list_findings', {
    title: 'List findings',
    description:
      'List architecture findings with their evidence and limitations, most important first. Kinds: cycle ' +
      '(circular dependency), hotspot (complex and widely used), god-object (highly coupled), dead-code ' +
      '(possibly unused), pattern (design pattern).',
    inputSchema: {
      target,
      kind: z.enum(FINDING_KINDS as [string, ...string[]]).optional(),
      min_confidence: z.enum(CONFIDENCE_LEVELS as [string, ...string[]]).optional().describe('Default: medium.'),
      path: z.string().optional().describe('Only findings in this file, or under this directory if it ends in "/".'),
      offset,
      limit: limit(20),
    },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, kind, min_confidence, path, offset: o, limit: l }) => {
    const { result } = await load(t);
    return json(listFindings(result, {
      kind: kind as never,
      minConfidence: (min_confidence ?? 'medium') as never,
      path,
      offset: o,
      limit: l ?? 20,
    }));
  }));

  server.registerTool('get_finding', {
    title: 'Get a finding',
    description: 'Return one finding by its id (from analyze_project or list_findings), with full evidence.',
    inputSchema: { target, id: z.string() },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, id }) => {
    const finding = getFinding((await load(t)).result, id);
    return finding ? json(finding) : failure(`No finding with id ${id}`);
  }));

  server.registerTool('search_symbols', {
    title: 'Search symbols',
    description: 'Find files, classes, interfaces and functions by name or path fragment. Exact matches rank first.',
    inputSchema: {
      target,
      query: z.string().min(1),
      type: z.enum(['file', 'class', 'interface', 'function', 'database']).optional(),
      offset,
      limit: limit(20),
    },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, query, type, offset: o, limit: l }) =>
    json(searchSymbols((await load(t)).result, query, { type, offset: o, limit: l ?? 20 }))));

  server.registerTool('trace_dependencies', {
    title: 'Trace dependencies',
    description:
      'Walk the dependency graph from a node. direction "dependents" answers "what breaks if I change this?"; ' +
      '"dependencies" answers "what does this rely on?". The node can be an id, a file path or a symbol name.',
    inputSchema: {
      target,
      node: z.string().min(1),
      direction: z.enum(['dependents', 'dependencies']),
      depth: z.number().int().min(1).max(5).optional().describe('Hops to follow (default 1).'),
      offset,
      limit: limit(50),
    },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, node, direction, depth, offset: o, limit: l }) => {
    const { result } = await load(t);
    const resolved = resolveNode(result, node);
    if (resolved.status === 'not-found') return failure(`No node matches "${node}". Try search_symbols.`);
    if (resolved.status === 'ambiguous') {
      return json({ ambiguous: true, message: 'Several nodes match; call again with one of these ids.', candidates: resolved.candidates });
    }
    return json({ node: resolved.node, direction, ...neighbours(result, resolved.node.id, direction, { depth, offset: o, limit: l ?? 50 }) });
  }));

  server.registerTool('read_source', {
    title: 'Read source',
    description: 'Read numbered lines of a file in the analyzed project (at most 400 lines per call).',
    inputSchema: {
      target,
      file: z.string().min(1).describe('Path relative to the project root, as shown in findings.'),
      start_line: z.number().int().min(1).optional(),
      end_line: z.number().int().min(1).optional(),
    },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, file, start_line, end_line }) =>
    json(readSource((await load(t)).root, file, start_line, end_line))));

  server.registerTool('export_diagram', {
    title: 'Export a dependency diagram',
    description: 'File-level dependency graph as a Mermaid flowchart, cut to the most-connected files.',
    inputSchema: { target, max_nodes: z.number().int().min(1).max(300).optional().describe('Default 60.') },
    annotations: READ_ONLY,
  }, tool(async ({ target: t, max_nodes }) => ({
    content: [{ type: 'text', text: toMermaid((await load(t)).result, max_nodes ?? 60) }],
  })));

  const dispose = () => {
    for (const pending of sessions.values()) void pending.then(a => a.dispose(), () => {});
    sessions.clear();
  };
  return { server, dispose };
}

/** Serve over stdio until the client disconnects. */
export async function runStdioServer(): Promise<void> {
  const { server, dispose } = createAtlasMcpServer();
  const shutdown = () => {
    dispose();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', shutdown);
  await server.connect(new StdioServerTransport());
  console.error(`reverse-architect MCP server ${PACKAGE_VERSION} ready on stdio`);
}
