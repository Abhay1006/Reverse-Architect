import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeFileWithText } from '../src/lsp/text-analyzer.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'languages');

/** One line per file, so a regression shows exactly which language broke. */
function summarize(file: string) {
  const p = analyzeFileWithText(path.join(dir, file));
  return {
    analyzer: p.analyzer,
    imports: p.imports.map(i => i.moduleSpecifier + (i.namedImports.length ? `{${i.namedImports.join(',')}}` : '')),
    classes: p.classes.map(c => ({ name: c.name, extends: c.extends, implements: c.implements, methods: c.methods.map(m => m.name) })),
    interfaces: p.interfaces.map(i => i.name),
    functions: p.functions.map(f => f.name),
  };
}

describe('text extractor', () => {
  it('Python', () => {
    expect(summarize('a.py')).toEqual({
      analyzer: 'text',
      imports: ['app/models{User,Order}', 'os'],
      classes: [{ name: 'Service', extends: 'Base', implements: [], methods: ['run'] }],
      interfaces: [],
      functions: ['helper'],
    });
  });

  it('Go, including grouped import blocks', () => {
    const go = summarize('a.go');
    expect(go.imports).toEqual(['fmt', 'example.com/app/store']);
    expect(go.classes.map(c => c.name)).toEqual(['Server']);
    expect(go.functions).toEqual(['NewServer']);
  });

  it('Java: interface methods are not top-level functions', () => {
    expect(summarize('A.java')).toMatchObject({
      imports: ['com/example/model{User}'],
      classes: [{ name: 'Service', extends: 'Base', implements: ['Runnable'], methods: ['run', 'helper'] }],
      interfaces: ['Repo'],
      functions: [],
    });
  });

  it('Kotlin: superclass from the constructor call, no constructor-as-function', () => {
    expect(summarize('a.kt')).toMatchObject({
      classes: [{ name: 'Service', extends: 'Base', implements: [], methods: ['run'] }],
      interfaces: ['Repo'],
      functions: [],
    });
  });

  it('C#: splits base class from I-prefixed interfaces', () => {
    expect(summarize('a.cs').classes).toEqual([{ name: 'Service', extends: 'Base', implements: ['IRunner'], methods: ['Run'] }]);
  });

  it('Swift: one import per statement, protocols as interfaces', () => {
    expect(summarize('a.swift')).toMatchObject({ imports: ['Foundation'], interfaces: ['Runner'] });
  });

  it('Rust, Ruby and PHP', () => {
    expect(summarize('a.rs')).toMatchObject({ imports: ['./store{Db,Row}'], interfaces: ['Handler'], functions: ['new_server'] });
    expect(summarize('a.rb')).toMatchObject({ imports: ['models/user'], classes: [{ name: 'Service', extends: 'Base' }] });
    expect(summarize('a.php').classes).toEqual([{ name: 'Service', extends: 'Base', implements: ['Runner'], methods: ['run'] }]);
  });
});
