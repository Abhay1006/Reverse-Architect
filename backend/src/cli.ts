#!/usr/bin/env node
// ============================================================
//  Reverse Architect — CLI
//  Analyze a codebase from the terminal or a CI job.
//  Results go to stdout (human-readable, or JSON with --json);
//  progress goes to stderr, so `--json | jq` always works.
// ============================================================

import './stdio-guard.js';
import { parseArgs } from 'util';
import type { Confidence, Finding, FindingKind } from 'shared';
import { PACKAGE_VERSION } from './package-info.js';

const HELP = `reverse-architect ${PACKAGE_VERSION}
Architecture analysis for codebases: dependencies, circular imports, hotspots,
coupling, possibly unused code and design patterns, each with its evidence.

Usage:
  reverse-architect analyze  <target>            Overview of the project
  reverse-architect findings <target>            List findings (filter with --kind)
  reverse-architect cycles | hotspots | god-objects | dead-code | patterns <target>
  reverse-architect search   <target> <query>    Find files and symbols by name
  reverse-architect deps     <target> <node>     What <node> depends on (--dependents: what depends on it)
  reverse-architect export   <target>            Mermaid diagram (or --format json for the full graph)
  reverse-architect mcp                          Run as an MCP server over stdio

<target> is a directory or a https://github.com/<owner>/<repo> URL.

Options:
  --json                    Machine-readable output
  --kind <kind>             cycle | hotspot | god-object | dead-code | pattern
  --min-confidence <level>  high | medium | low   (default: medium)
  --path <path>             Only findings in this file, or under this dir if it ends in /
  --limit <n>, --offset <n> Paging (default limit 20)
  --type <type>             search: file | class | interface | function | database
  --dependents              deps: walk towards the node's dependents instead
  --depth <n>               deps: hops to follow (default 1, max 5)
  --format <fmt>            export: mermaid (default) | json
  --max-nodes <n>           export: diagram size cap (default 60)
  --fail-on-findings        Exit 1 if any finding matches (for CI)
  -h, --help, -v, --version

Exit codes: 0 success, 1 findings matched with --fail-on-findings, 2 error.
`;

const KIND_COMMANDS: Record<string, FindingKind> = {
  cycles: 'cycle',
  hotspots: 'hotspot',
  'god-objects': 'god-object',
  'dead-code': 'dead-code',
  patterns: 'pattern',
};

class UsageError extends Error {}

function out(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}

function int(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`--${name} must be a non-negative integer`);
  return n;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], name: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new UsageError(`--${name} must be one of: ${allowed.join(', ')}`);
  return value as T;
}

function formatFinding(f: Finding): string {
  const lines = [`[${f.confidence.toUpperCase()}] ${f.title}`, `  id: ${f.id}`];
  for (const e of f.evidence) {
    const where = e.location ? ` (${e.location.filePath}${e.location.line ? `:${e.location.line}` : ''})` : '';
    lines.push(`  ${e.basis === 'observed' ? '•' : '→'} ${e.detail}${where}`);
  }
  for (const l of f.limitations) lines.push(`  ! ${l}`);
  return lines.join('\n');
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      kind: { type: 'string' },
      'min-confidence': { type: 'string' },
      path: { type: 'string' },
      limit: { type: 'string' },
      offset: { type: 'string' },
      type: { type: 'string' },
      dependents: { type: 'boolean' },
      depth: { type: 'string' },
      format: { type: 'string' },
      'max-nodes': { type: 'string' },
      'fail-on-findings': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  if (values.version) {
    out(PACKAGE_VERSION);
    return 0;
  }
  const [command, target, extra] = positionals;
  if (values.help || !command) {
    out(HELP);
    return values.help ? 0 : 2;
  }

  if (command === 'mcp') {
    const { runStdioServer } = await import('./mcp/server.js');
    await runStdioServer();
    return -1; // keep running; the server exits the process itself
  }

  const known = ['analyze', 'findings', 'search', 'deps', 'export', ...Object.keys(KIND_COMMANDS)];
  if (!known.includes(command)) throw new UsageError(`Unknown command "${command}". Run with --help.`);
  if (!target) throw new UsageError(`"${command}" needs a <target> directory or GitHub URL`);
  if ((command === 'search' || command === 'deps') && !extra) {
    throw new UsageError(`"${command}" needs a ${command === 'search' ? '<query>' : '<node>'} after the target`);
  }

  // Validate every option before the (slow) analysis starts.
  const q = await import('./query/index.js');
  const limit = int(values.limit, 'limit');
  const offset = int(values.offset, 'offset');
  const minConfidence = oneOf<Confidence>(values['min-confidence'], q.CONFIDENCE_LEVELS, 'min-confidence') ?? 'medium';
  const kind = KIND_COMMANDS[command] ?? oneOf<FindingKind>(values.kind, q.FINDING_KINDS, 'kind');
  const format = oneOf(values.format, ['mermaid', 'json'] as const, 'format') ?? 'mermaid';
  const depth = int(values.depth, 'depth');
  const maxNodes = int(values['max-nodes'], 'max-nodes');

  const loaded = await q.analyzeTarget(target);
  try {
    const { result } = loaded;

    if (command === 'analyze') {
      const o = q.overview(loaded);
      if (values.json) {
        out(JSON.stringify(o, null, 2));
        return 0;
      }
      const c = o.coverage;
      out([
        `Project:     ${o.target}`,
        `Entry point: ${o.entryPoint ? `${o.entryPoint.entryFile} (${o.entryPoint.framework})` : 'none detected'}`,
        `Nodes:       ${Object.entries(o.nodesByType).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}`,
        `Edges:       ${Object.entries(o.edgesByRelation).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}`,
        `Parsed:      ${c.filesParsed} files (LSP ${c.filesByAnalyzer.lsp}, text ${c.filesByAnalyzer.text}, schema ${c.filesByAnalyzer.schema}); ${c.filesInGraph} in graph`,
        '',
        'Findings (high / medium / low):',
        ...q.FINDING_KINDS.map(k => {
          const n = o.findingCounts[k] ?? {};
          return `  ${k.padEnd(11)} ${n.high ?? 0} / ${n.medium ?? 0} / ${n.low ?? 0}`;
        }),
        '',
        'Top findings:',
        ...(o.topFindings.length ? o.topFindings.map(f => `  [${f.confidence}] ${f.title}`) : ['  none']),
        '',
        'Limitations:',
        ...c.limitations.map(l => `  ! ${l}`),
      ].join('\n'));
      return 0;
    }

    if (command === 'findings' || command in KIND_COMMANDS) {
      const pageOf = q.listFindings(result, { kind, minConfidence, path: values.path, offset, limit });
      if (values.json) out(JSON.stringify(pageOf, null, 2));
      else {
        out(pageOf.items.length ? pageOf.items.map(formatFinding).join('\n\n') : 'No findings match.');
        if (pageOf.nextOffset !== null) {
          out(`\nShowing ${pageOf.items.length} of ${pageOf.total}. Next page: --offset ${pageOf.nextOffset}`);
        }
      }
      return values['fail-on-findings'] && pageOf.total > 0 ? 1 : 0;
    }

    if (command === 'search') {
      const hits = q.searchSymbols(result, extra!, { type: values.type, offset, limit });
      if (values.json) out(JSON.stringify(hits, null, 2));
      else out(hits.items.length ? hits.items.map(h => `${h.type.padEnd(9)} ${h.label}  ${h.filePath}\n          id: ${h.id}`).join('\n') : 'No matches.');
      return 0;
    }

    if (command === 'deps') {
      const resolved = q.resolveNode(result, extra!);
      if (resolved.status === 'not-found') throw new Error(`No node matches "${extra}". Try: search ${target} ${extra}`);
      if (resolved.status === 'ambiguous') {
        throw new Error(`"${extra}" is ambiguous. Use one of these ids:\n${resolved.candidates.map(c => `  ${c.id}`).join('\n')}`);
      }
      const direction = values.dependents ? 'dependents' : 'dependencies';
      const walk = q.neighbours(result, resolved.node.id, direction, { depth, offset, limit });
      if (values.json) out(JSON.stringify({ node: resolved.node, direction, ...walk }, null, 2));
      else {
        out(`${direction === 'dependents' ? 'Depended on by' : 'Depends on'} (${walk.total}): ${resolved.node.label}`);
        for (const n of walk.items) out(`${'  '.repeat(n.depth)}${n.relation.padEnd(10)} ${n.type.padEnd(9)} ${n.label}  ${n.filePath}`);
      }
      return 0;
    }

    // export
    out(format === 'json' ? JSON.stringify(result, null, 2) : q.toMermaid(result, maxNodes ?? 60));
    return 0;
  } finally {
    loaded.dispose();
  }
}

main(process.argv.slice(2)).then(
  code => {
    if (code >= 0) process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    if (err instanceof UsageError) process.stderr.write('Run with --help for usage.\n');
    process.exitCode = 2;
  },
);
