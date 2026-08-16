import { describe, it, expect } from 'vitest';
import { importCandidatePaths } from '../src/graph/import-candidates.js';
import { buildGraph } from '../src/graph/graph-builder.js';
import type { ParsedFile } from '../../shared/types.js';

function file(filePath: string, imports: string[]): ParsedFile {
  return {
    kind: 'file',
    name: filePath.split('/').pop()!,
    filePath,
    imports: imports.map((moduleSpecifier) => ({
      kind: 'import' as const,
      moduleSpecifier,
      namedImports: [],
    })),
    classes: [],
    interfaces: [],
    functions: [],
    lineCount: 10,
  };
}

describe('importCandidatePaths', () => {
  it('maps a TypeScript ESM .js specifier back to its .ts source', () => {
    const candidates = importCandidatePaths('/p/src/api/routes.js');
    expect(candidates).toContain('/p/src/api/routes.ts');
    expect(candidates).toContain('/p/src/api/routes.tsx');
  });

  it('prefers a real .js file over the .ts mapping when both could exist', () => {
    // In a plain JavaScript project `./routes.js` really does mean routes.js,
    // so an exact hit must win; the .ts rewrite is the fallback.
    const candidates = importCandidatePaths('/p/src/routes.js');
    expect(candidates[0]).toBe('/p/src/routes.js');
    expect(candidates.indexOf('/p/src/routes.ts')).toBeGreaterThan(0);
  });

  it('prefers .ts over .tsx when neither file is known', () => {
    const candidates = importCandidatePaths('/p/src/routes.js');
    expect(candidates.indexOf('/p/src/routes.ts')).toBeLessThan(
      candidates.indexOf('/p/src/routes.tsx')
    );
  });

  it('maps .mjs and .cjs to their TypeScript counterparts', () => {
    expect(importCandidatePaths('/p/a.mjs')).toContain('/p/a.mts');
    expect(importCandidatePaths('/p/a.cjs')).toContain('/p/a.cts');
  });

  it('still handles extensionless specifiers and index files', () => {
    const candidates = importCandidatePaths('/p/src/utils');
    expect(candidates).toContain('/p/src/utils.ts');
    expect(candidates).toContain('/p/src/utils/index.ts');
  });

  it('returns the exact path first', () => {
    expect(importCandidatePaths('/p/a.ts')[0]).toBe('/p/a.ts');
  });
});

describe('buildGraph reachability with NodeNext imports', () => {
  // A NodeNext/ESM TypeScript project: sources are .ts but import each other
  // with the compiled .js extension. This used to resolve nothing, collapsing
  // the whole graph to the single entry-point node.
  const files: ParsedFile[] = [
    file('src/server.ts', ['./api/routes.js', './cache/db.js']),
    file('src/api/routes.ts', ['../cache/db.js']),
    file('src/cache/db.ts', []),
    file('src/orphan.ts', []),
  ];

  it('follows .js specifiers to .ts files from the entry point', () => {
    const graph = buildGraph(files, ['src/server.ts']);
    const ids = graph.nodes.map((n) => n.id);

    expect(ids).toContain('file:src/server.ts');
    expect(ids).toContain('file:src/api/routes.ts');
    expect(ids).toContain('file:src/cache/db.ts');
  });

  it('still excludes files unreachable from the entry point', () => {
    const graph = buildGraph(files, ['src/server.ts']);
    expect(graph.nodes.map((n) => n.id)).not.toContain('file:src/orphan.ts');
  });

  it('produces import edges rather than an isolated node', () => {
    const graph = buildGraph(files, ['src/server.ts']);
    const importEdges = graph.edges.filter((e) => e.type === 'import');
    expect(importEdges.length).toBeGreaterThan(0);
  });

  it('includes every file when no entry point is given', () => {
    const graph = buildGraph(files);
    expect(graph.nodes.filter((n) => n.type === 'file')).toHaveLength(4);
  });
});
