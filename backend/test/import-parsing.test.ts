import { describe, it, expect } from 'vitest';
import { parseImportsFromText } from '../src/lsp/lsp-adapter.js';
import { buildGraph } from '../src/graph/graph-builder.js';
import type { ParsedFile, ParsedImport } from '../../shared/types.js';

describe('parseImportsFromText', () => {
  it('flags `import type` statements', () => {
    const [imp] = parseImportsFromText(`import type { User } from './user';`, 'ts');
    expect(imp).toMatchObject({ moduleSpecifier: './user', namedImports: ['User'], typeOnly: true });
    expect(parseImportsFromText(`import { User } from './user';`, 'ts')[0]?.typeOnly).toBeUndefined();
  });

  it('finds dynamic import() with a static specifier', () => {
    const imports = parseImportsFromText(`const page = await import('./pages/about');\nimport(name);`, 'ts');
    expect(imports).toEqual([{ kind: 'import', moduleSpecifier: './pages/about', namedImports: [], dynamic: true }]);
  });

  it('finds require() that is not assigned to a variable', () => {
    const imports = parseImportsFromText(`module.exports = require('./lib/express');\nrequire('./setup')(app);`, 'js');
    expect(imports.map(i => i.moduleSpecifier)).toEqual(['./lib/express', './setup']);
  });

  it('does not count a require() twice when it is also bound to a variable', () => {
    const imports = parseImportsFromText(`const a = require('./a');\nrequire('./b');`, 'js');
    expect(imports.map(i => i.moduleSpecifier)).toEqual(['./a', './b']);
  });
});

describe('import edges', () => {
  const file = (filePath: string, imports: Partial<ParsedImport>[]): ParsedFile => ({
    kind: 'file', name: filePath, filePath, classes: [], interfaces: [], functions: [], lineCount: 1,
    imports: imports.map(i => ({ kind: 'import', moduleSpecifier: '', namedImports: [], ...i })),
  });

  it('is type-only only when every import behind it is', () => {
    const typeOnly = buildGraph([file('a.ts', [{ moduleSpecifier: './b', typeOnly: true }]), file('b.ts', [])]);
    const mixed = buildGraph([
      file('a.ts', [{ moduleSpecifier: './b', typeOnly: true }, { moduleSpecifier: './b', namedImports: ['x'] }]),
      file('b.ts', []),
    ]);
    expect(typeOnly.edges.find(e => e.type === 'import')?.typeOnly).toBe(true);
    expect(mixed.edges.find(e => e.type === 'import')?.typeOnly).toBeUndefined();
  });

  it('follows dynamic imports when computing reachability', () => {
    const g = buildGraph([
      file('index.ts', [{ moduleSpecifier: './lazy', dynamic: true }]),
      file('lazy.ts', []),
      file('orphan.ts', []),
    ], ['index.ts']);
    expect(g.nodes.map(n => n.filePath).sort()).toEqual(['index.ts', 'lazy.ts']);
  });
});
