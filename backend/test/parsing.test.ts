import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseImportsFromText, extractCalledFunctionsFromText } from '../src/lsp/lsp-adapter.js';
import { estimateComplexityFromText } from '../src/lsp/lsp-complexity.js';
import { LspManager } from '../src/lsp/lsp-manager.js';
import { findImportedEntityIds } from '../src/graph/graph-builder.js';
import { analyzeProjectDir, mapEntryToSource } from '../src/api/analyzer-pipeline.js';
import { scrubSecrets } from '../src/api/errors.js';
import type { ParsedFile } from 'shared';

const here = path.dirname(fileURLToPath(import.meta.url));

const specifiers = (text: string, lang?: Parameters<typeof parseImportsFromText>[1]) =>
  parseImportsFromText(text, lang).map((i) => i.moduleSpecifier);

describe('parseImportsFromText', () => {
  it('records a side-effect import once, not once per language pattern', () => {
    expect(specifiers('import "./styles.css";', 'ts')).toEqual(['./styles.css']);
  });

  it('detects re-exports, so barrel files have edges', () => {
    const imports = parseImportsFromText(
      "export * from './all';\nexport * as ns from './ns';\nexport { a, b as c } from \"./some\";",
      'ts',
    );
    expect(imports.map((i) => i.moduleSpecifier)).toEqual(['./all', './ns', './some']);
    expect(imports.every((i) => i.isReExport)).toBe(true);
    expect(imports[1]!.namespaceImport).toBe('ns');
    expect(imports[2]!.namedImports).toEqual(['a', 'b']);
  });

  it('detects dynamic imports, including destructured names', () => {
    const imports = parseImportsFromText(
      "const m = await import('./lazy');\nconst { createApp, b: alias } = await import('./app.js');",
      'ts',
    );
    expect(imports.map((i) => [i.moduleSpecifier, i.namedImports])).toEqual([
      ['./lazy', []],
      ['./app.js', ['createApp', 'b']],
    ]);
  });

  it('does not apply other languages\' syntax', () => {
    // `use strict`-style lines and Go/Python patterns must not leak into JS.
    expect(specifiers('import "fmt"\nfrom os import path', 'go')).toEqual(['fmt']);
    expect(specifiers('from os import path\nimport sys', 'py')).toEqual(['os', 'sys']);
  });

  it('parses Kotlin imports, which have no semicolon', () => {
    const imports = parseImportsFromText('import kotlin.collections.List\nimport foo.Bar', 'kt');
    expect(imports.map((i) => i.namedImports)).toEqual([['List'], ['Bar']]);
  });
});

describe('estimateComplexityFromText', () => {
  it.each([
    ['const x = a?.b?.c;', 1],              // optional chaining is not a branch
    ['if (a) {} else if (b) {}', 3],        // else-if counted once
    ['const y = a ?? b;', 2],
    ['const z = a ? b : c;', 2],
    ['do { } while (x)', 2],                // do-while counted once
    ['for await (const a of b) {}', 2],
    ['function f(a?: string) {}', 1],       // optional parameter is not a branch
  ])('%s → %i', (code, expected) => {
    expect(estimateComplexityFromText(code)).toBe(expected);
  });
});

describe('extractCalledFunctionsFromText', () => {
  it('treats rendered JSX components as references', () => {
    const calls = extractCalledFunctionsFromText('return (<div><Navbar /><Footer></Footer></div>);');
    expect(calls).toEqual(expect.arrayContaining(['Navbar', 'Footer']));
  });

  it('does not mistake generic type arguments for JSX', () => {
    const calls = extractCalledFunctionsFromText('const [s] = useState<Props>(null); const l: List<Item> = [];');
    expect(calls).not.toContain('Props');
    expect(calls).not.toContain('Item');
  });
});

describe('mapEntryToSource', () => {
  const parsed = ['src/server.ts', 'src/api/routes.ts', 'scripts/server.ts'];

  it('keeps an entry that was parsed', () => {
    expect(mapEntryToSource('src/server.ts', parsed)).toBe('src/server.ts');
  });

  it('maps compiled output back to its source', () => {
    expect(mapEntryToSource('dist/backend/src/server.js', parsed)).toBe('src/server.ts');
    expect(mapEntryToSource('build/src/api/routes.js', parsed)).toBe('src/api/routes.ts');
  });

  it('does not guess for paths outside an output directory', () => {
    expect(mapEntryToSource('other/server.js', parsed)).toBeNull();
  });
});

describe('findImportedEntityIds', () => {
  const file = (filePath: string, imports: ParsedFile['imports'], fns: string[] = []): ParsedFile => ({
    kind: 'file', name: path.basename(filePath), filePath, imports, classes: [], interfaces: [],
    functions: fns.map((name) => ({
      kind: 'function' as const, name, isExported: true, parameters: [], returnType: 'void', lineCount: 1, complexity: 1,
    })),
    lineCount: 1,
  });

  it('marks named, default and namespace imports as references', () => {
    const files = [
      file('src/index.js', [
        { kind: 'import', moduleSpecifier: './App', defaultImport: 'App', namedImports: [] },
        { kind: 'import', moduleSpecifier: './util', namedImports: ['helper'] },
        { kind: 'import', moduleSpecifier: './all', namedImports: [], namespaceImport: 'all' },
      ]),
      file('src/App.js', [], ['App']),
      file('src/util.js', [], ['helper', 'unused']),
      file('src/all.js', [], ['one', 'two']),
    ];
    const ids = findImportedEntityIds(files);
    expect(ids).toEqual(new Set([
      'entity:src/App.js:App',
      'entity:src/util.js:helper',
      'entity:src/all.js:one',
      'entity:src/all.js:two',
    ]));
  });
});

describe('scrubSecrets', () => {
  it('scrubs HTTP Basic/Bearer credentials, which are just the token in base64', () => {
    expect(scrubSecrets('git -c http.extraHeader=Authorization: Basic eC1hY2Nlc3M6c2VjcmV0 ls-remote'))
      .toBe('git -c http.extraHeader=Authorization: Basic *** ls-remote');
  });
});

describe('LspManager', () => {
  it('answers server-initiated requests (they used to be treated as notifications)', async () => {
    const manager = new LspManager({
      serverBin: path.join(here, 'fixtures', 'lsp', 'fake-server.mjs'),
      requestTimeout: 3000,
    });
    // The fake server only answers `initialize` after its own request is answered.
    await expect(manager.start(here)).resolves.toBeDefined();
    await manager.shutdown();
  });
});

describe('analysis pipeline on a React project', () => {
  it('maps the entry point and does not report rendered components as dead code', async () => {
    const result = await analyzeProjectDir(path.join(here, 'fixtures', 'portfolio'));
    expect(result.entryPoint?.entryFile).toBe('src/index.js');
    // App is only used as <App /> at module top level of index.js.
    expect(result.analysis.deadCode).not.toContain('entity:src/App.js:App');
    // A small app has no god objects worth flagging beyond its hub.
    expect(result.analysis.godObjects.length).toBeLessThanOrEqual(1);
  }, 60_000);
});
