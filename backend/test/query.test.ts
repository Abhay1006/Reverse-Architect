import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGraphPipeline } from '../src/api/analyzer-pipeline.js';
import {
  getFinding, listFindings, neighbours, overview, readSource, resolveNode, searchSymbols, toMermaid, MAX_SOURCE_LINES,
} from '../src/query/index.js';
import type { ParsedFile, ParsedImport } from '../../shared/types.js';

const file = (filePath: string, imports: string[], extra: Partial<ParsedFile> = {}): ParsedFile => ({
  kind: 'file', name: filePath.split('/').pop()!, filePath, analyzer: 'lsp', classes: [], interfaces: [], functions: [], lineCount: 5,
  imports: imports.map((moduleSpecifier): ParsedImport => ({ kind: 'import', moduleSpecifier, namedImports: [] })),
  ...extra,
});

const fn = (name: string) => ({ kind: 'function' as const, name, isExported: true, parameters: [], returnType: 'void', lineCount: 3, complexity: 1 });

// index → a ⇄ b, a → util; util/format also declared in b (ambiguous name)
const result = runGraphPipeline([
  file('src/index.ts', ['./a']),
  file('src/a.ts', ['./b', './util']),
  file('src/b.ts', ['./a'], { functions: [fn('format')] }),
  file('src/util.ts', [], { functions: [fn('format'), fn('formatDate')] }),
  file('src/old.ts', []),
], [{ entryFile: 'src/index.ts', framework: 'node' }]);

describe('overview', () => {
  it('summarizes without listing everything', () => {
    const o = overview({ target: 'demo', result });
    expect(o.nodesByType).toEqual({ file: 4, function: 3 });
    expect(o.findingCounts.cycle).toEqual({ high: 1 });
    expect(o.coverage.graphScope).toBe('entry-points');
    expect(o.topFindings[0]).toEqual({
      id: 'cycle:file:src/a.ts|file:src/b.ts', kind: 'cycle', confidence: 'high', title: expect.stringContaining('src/a.ts'),
    });
  });
});

describe('listFindings', () => {
  it('filters by kind, confidence and path, and pages', () => {
    expect(listFindings(result, { kind: 'cycle' }).total).toBe(1);
    expect(listFindings(result, { kind: 'dead-code', minConfidence: 'medium' }).items.map(f => f.id)).toEqual(['dead-code:unreachable:src/old.ts']);
    expect(listFindings(result, { kind: 'dead-code' }).total).toBe(4); // low-confidence unused functions too
    expect(listFindings(result, { path: 'src/old.ts' }).total).toBe(1);
    expect(listFindings(result, { path: 'src/' }).total).toBeGreaterThan(1);

    const first = listFindings(result, { minConfidence: 'low', limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextOffset).toBe(1);
    const all = listFindings(result, { minConfidence: 'low', limit: 500 });
    expect(all.items.length).toBe(all.total);
    expect(all.nextOffset).toBeNull();
  });

  it('gets a finding by id', () => {
    expect(getFinding(result, 'cycle:file:src/a.ts|file:src/b.ts')?.kind).toBe('cycle');
    expect(getFinding(result, 'nope')).toBeNull();
  });
});

describe('resolveNode and search', () => {
  it('resolves ids, paths and unique names, and reports ambiguity', () => {
    expect(resolveNode(result, 'file:src/a.ts')).toMatchObject({ status: 'found' });
    expect(resolveNode(result, './src/util.ts')).toMatchObject({ status: 'found', node: { id: 'file:src/util.ts' } });
    expect(resolveNode(result, 'formatDate')).toMatchObject({ status: 'found', node: { type: 'function' } });
    const amb = resolveNode(result, 'format');
    expect(amb.status).toBe('ambiguous');
    expect(amb.status === 'ambiguous' && amb.candidates.map(c => c.id).sort()).toEqual(['entity:src/b.ts:format', 'entity:src/util.ts:format']);
    expect(resolveNode(result, 'missing')).toEqual({ status: 'not-found' });
  });

  it('ranks exact, then prefix, then substring matches', () => {
    expect(searchSymbols(result, 'format').items.map(h => [h.label, h.rank])).toEqual([
      ['format', 0], ['format', 0], ['formatDate', 1],
    ]);
    expect(searchSymbols(result, 'format', { type: 'file' }).total).toBe(0);
    expect(searchSymbols(result, '  ').total).toBe(0);
  });
});

describe('neighbours', () => {
  it('walks dependents and dependencies to the requested depth', () => {
    const deps = neighbours(result, 'file:src/index.ts', 'dependencies', { depth: 2 });
    expect(deps.items.map(n => [n.id, n.depth])).toEqual([
      ['file:src/a.ts', 1], ['file:src/b.ts', 2], ['file:src/util.ts', 2],
    ]);
    expect(neighbours(result, 'file:src/util.ts', 'dependents').items.map(n => n.id)).toEqual(['file:src/a.ts']);
  });
});

describe('readSource', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ra-query-'));
  fs.writeFileSync(path.join(root, 'big.ts'), Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join('\n'));
  fs.writeFileSync(path.join(os.tmpdir(), 'ra-outside.txt'), 'secret');

  it('returns numbered lines and caps the excerpt', () => {
    const ex = readSource(root, 'big.ts', 10, 12);
    expect(ex.text).toBe('10  line 10\n11  line 11\n12  line 12');
    const capped = readSource(root, 'big.ts');
    expect(capped.endLine).toBe(MAX_SOURCE_LINES);
    expect(capped.truncated).toBe(true);
  });

  it('refuses paths that leave the project', () => {
    expect(() => readSource(root, '../ra-outside.txt')).toThrow(/not found/);
    expect(() => readSource(root, path.join(os.tmpdir(), 'ra-outside.txt'))).toThrow(/not found/);
    fs.symlinkSync(path.join(os.tmpdir(), 'ra-outside.txt'), path.join(root, 'link.txt'));
    expect(() => readSource(root, 'link.txt')).toThrow(/not found/);
  });
});

describe('toMermaid', () => {
  it('draws file dependencies and says when it is cut', () => {
    const full = toMermaid(result);
    expect(full).toMatch(/^flowchart LR\n/);
    expect(full).toContain('"src/a.ts"');
    const cut = toMermaid(result, 2);
    expect(cut).toContain('Showing the 2 most-connected of 4 files');
  });
});
