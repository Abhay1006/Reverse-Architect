import { describe, it, expect } from 'vitest';
import { buildFindings, computeCoverage } from '../src/analyzers/findings.js';
import { detectHotspots } from '../src/analyzers/hotspots.js';
import { detectCycles } from '../src/graph/algorithms/cycle-detection.js';
import { runGraphPipeline } from '../src/api/analyzer-pipeline.js';
import type { ParsedFile } from '../../shared/types.js';
import { edge, graph, node } from './support/graph.js';

const parsed = (filePath: string, analyzer: ParsedFile['analyzer'] = 'lsp'): ParsedFile => ({
  kind: 'file', name: filePath.split('/').pop()!, filePath, analyzer, imports: [], classes: [], interfaces: [], functions: [], lineCount: 1,
});

function findingsFor(g: ReturnType<typeof graph>, extra: Partial<Parameters<typeof buildFindings>[0]> = {}) {
  return buildFindings({
    graph: g, cycles: detectCycles(g), hotspots: [], godObjects: [], deadCode: [], unreachableFiles: [], entryFiles: [], patterns: [], ...extra,
  });
}

describe('cycle findings', () => {
  it('cites every edge of the cycle', () => {
    const g = graph([node('file:a', 'file'), node('file:b', 'file')], [edge('file:a', 'file:b'), edge('file:b', 'file:a')]);
    const [f] = findingsFor(g);
    expect(f).toMatchObject({ kind: 'cycle', confidence: 'high', nodeIds: ['file:a', 'file:b'] });
    expect(f!.evidence.map(e => e.detail)).toEqual(['a imports b', 'b imports a']);
    expect(f!.evidence[0]!.location).toEqual({ filePath: 'src/a.ts' });
  });

  it('reports type-level cycles at low confidence', () => {
    const g = graph([node('file:a', 'file'), node('file:b', 'file')], [
      edge('file:a', 'file:b', 'import', { typeOnly: true }),
      edge('file:b', 'file:a'),
    ]);
    const [f] = findingsFor(g, { cycles: [], typeCycles: detectCycles(g) });
    expect(f).toMatchObject({ confidence: 'low', title: expect.stringMatching(/^Type-level cycle/) });
    expect(f!.limitations[0]).toMatch(/1 of 2 link\(s\) are `import type`.*no runtime effect/);
  });

  it('is medium confidence when a link is a call backed by an import', () => {
    const g = graph([node('file:a', 'file'), node('file:b', 'file')], [
      edge('file:a', 'file:b'), edge('file:b', 'file:a', 'calls'), edge('file:b', 'file:a', 'import', { typeOnly: true }),
    ]);
    expect(findingsFor(g, { cycles: [['file:a', 'file:b']] })[0]!.confidence).toBe('medium');
  });

  it('is low confidence when a JS/TS call crosses into a file the caller never imports', () => {
    const g = graph([node('file:a', 'file'), node('file:b', 'file')], [edge('file:a', 'file:b'), edge('file:b', 'file:a', 'calls')]);
    const [f] = findingsFor(g);
    expect(f!.confidence).toBe('low');
    expect(f!.limitations[0]).toMatch(/b → a: the caller never imports/);
  });

  it('treats a cycle inside one file as recursion', () => {
    const g = graph([
      node('entity:render', 'function', { filePath: 'src/app.ts' }),
      node('entity:tryRender', 'function', { filePath: 'src/app.ts' }),
    ], [edge('entity:render', 'entity:tryRender', 'calls'), edge('entity:tryRender', 'entity:render', 'calls')]);
    const [f] = findingsFor(g);
    expect(f!.confidence).toBe('low');
    expect(f!.limitations[0]).toMatch(/mutual recursion/);
  });
});

describe('pipeline', () => {
  const file = (filePath: string, imports: { to: string; typeOnly?: boolean }[] = []): ParsedFile => ({
    ...parsed(filePath),
    imports: imports.map(i => ({ kind: 'import', moduleSpecifier: i.to, namedImports: [], ...(i.typeOnly ? { typeOnly: true } : {}) })),
  });

  it('separates runtime cycles from cycles that need a type-only link', () => {
    const result = runGraphPipeline([
      file('src/a.ts', [{ to: './b' }]),
      file('src/b.ts', [{ to: './a' }, { to: './c' }]),
      file('src/c.ts', [{ to: './b', typeOnly: true }]),
    ], []);
    expect(result.analysis.cycles).toEqual([['file:src/a.ts', 'file:src/b.ts']]);
    expect(result.findings.filter(f => f.kind === 'cycle').map(f => [f.confidence, f.title.split(':')[0]])).toEqual([
      ['high', 'Circular dependency'],
      ['low', 'Type-level cycle'],
    ]);
  });

  it('never reports files that package.json points at as unused', () => {
    const files = [file('src/index.js', [{ to: './a' }]), file('src/a.js'), file('lib/null.js'), file('lib/old.js')];
    const result = runGraphPipeline(files, [{ entryFile: 'src/index.js', framework: 'node' }], ['lib/null.js']);
    expect(result.findings.filter(f => f.kind === 'dead-code').map(f => f.id)).toEqual(['dead-code:unreachable:lib/old.js']);
  });

  it('falls back to every file when entry points reach too little of the code', () => {
    const files = [file('src/server.js'), ...['a', 'b', 'c', 'd'].map(n => file(`lib/${n}.js`))];
    const result = runGraphPipeline(files, [{ entryFile: 'src/server.js', framework: 'express' }]);
    expect(result.coverage.graphScope).toBe('all-files');
    expect(result.coverage.limitations.join(' ')).toMatch(/reach only 1 of 5 source files/);
    expect(result.findings.some(f => f.id.startsWith('dead-code:unreachable:'))).toBe(false);
  });
});

describe('finding order', () => {
  it('groups by kind then confidence, keeping each builder\'s ranking', () => {
    const g = graph([
      node('entity:small', 'function', { complexity: 12 }),
      node('entity:big', 'function', { complexity: 40 }),
      node('file:a', 'file'), node('file:b', 'file'),
    ], [edge('file:a', 'file:b'), edge('file:b', 'file:a')]);
    const findings = findingsFor(g, { hotspots: detectHotspots(g) });
    expect(findings.map(f => f.id)).toEqual([
      'cycle:file:a|file:b',
      'hotspot:entity:big',
      'hotspot:entity:small',
    ]);
  });
});

describe('dead-code findings', () => {
  it('reports unreachable files with the entry points they are unreachable from', () => {
    const f = findingsFor(graph([]), { unreachableFiles: ['src/old.ts'], entryFiles: ['src/index.ts'] })[0]!;
    expect(f).toMatchObject({ id: 'dead-code:unreachable:src/old.ts', confidence: 'medium', nodeIds: [] });
    expect(f.evidence[0]!.detail).toContain('src/index.ts');
  });

  it('rates unused entities lower than unused files', () => {
    const findings = findingsFor(graph([node('file:x', 'file'), node('entity:fn', 'function')]), {
      deadCode: [
        { nodeId: 'file:x', label: 'x', nodeType: 'file', filePath: 'src/x.ts', outDegree: 0 },
        { nodeId: 'entity:fn', label: 'fn', nodeType: 'function', filePath: 'src/fn.ts', outDegree: 0 },
      ],
    });
    expect(Object.fromEntries(findings.map(f => [f.nodeIds[0], f.confidence]))).toEqual({ 'file:x': 'medium', 'entity:fn': 'low' });
  });

  it.each(['src/a.test.ts', 'test-d/types.ts', 'examples/app.js', 'gulpfile.js', 'rollup.config.mjs', 'docs/site.ts'])(
    'skips tests, tooling and examples: %s', (filePath) => {
      const findings = findingsFor(graph([]), {
        deadCode: [{ nodeId: 'file:t', label: 't', nodeType: 'file', filePath, outDegree: 1 }],
      });
      expect(findings).toEqual([]);
    });
});

describe('coverage', () => {
  it('lists files outside the entry-point graph, excluding tests and package markers', () => {
    const files = ['src/index.ts', 'src/old.ts', 'test/a.test.ts', 'pkg/__init__.py'].map(p => parsed(p));
    const g = graph([node('file:src/index.ts', 'file', { filePath: 'src/index.ts' })]);
    const { coverage, unreachableFiles } = computeCoverage(files, g, ['src/index.ts']);
    expect(unreachableFiles).toEqual(['src/old.ts']);
    expect(coverage).toMatchObject({ graphScope: 'entry-points', filesParsed: 4, filesInGraph: 1, entryFiles: ['src/index.ts'] });
  });

  it('counts files per extractor and warns about the text extractor', () => {
    const { coverage } = computeCoverage([parsed('a.py', 'text'), parsed('b.ts', 'lsp'), parsed('s.sql', 'schema')], graph([]), []);
    expect(coverage.filesByAnalyzer).toEqual({ lsp: 1, text: 1, schema: 1, unknown: 0 });
    expect(coverage.graphScope).toBe('all-files');
    expect(coverage.limitations.join(' ')).toMatch(/regex text extractor/);
  });
});

describe('hotspots', () => {
  it('weights complexity by fan-in and ignores simple code', () => {
    const g = graph([
      node('entity:a', 'function', { complexity: 15 }),
      node('entity:b', 'function', { complexity: 30 }),
      node('entity:c', 'function', { complexity: 3 }),
      node('entity:u1', 'function'), node('entity:u2', 'function'), node('entity:u3', 'function'),
    ], [edge('entity:u1', 'entity:a', 'calls'), edge('entity:u2', 'entity:a', 'calls'), edge('entity:u3', 'entity:a', 'calls')]);
    expect(detectHotspots(g).map(h => [h.nodeId, h.score])).toEqual([['entity:a', 60], ['entity:b', 30]]);
  });
});
