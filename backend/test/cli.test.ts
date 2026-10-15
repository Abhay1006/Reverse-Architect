import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = path.resolve(backend, '../bench/corpus/py-inventory');

function cli(...args: string[]) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], { cwd: backend, encoding: 'utf-8', timeout: 60_000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('CLI', () => {
  it('keeps stdout pure JSON with --json (progress goes to stderr)', () => {
    const r = cli('analyze', corpus, '--json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).coverage.filesByAnalyzer.text).toBeGreaterThan(0);
    expect(r.stderr).toContain('[Text]');
  });

  it('exits 1 with --fail-on-findings when findings match, 0 otherwise', () => {
    expect(cli('cycles', corpus, '--fail-on-findings').code).toBe(1);
    expect(cli('hotspots', corpus, '--fail-on-findings').code).toBe(0);
  });

  it('exits 2 on usage errors before analyzing anything', () => {
    const r = cli('findings', corpus, '--kind', 'nonsense');
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/--kind must be one of/);
    expect(r.stderr).not.toContain('[Text]');
  });

  it('prints help and version', () => {
    expect(cli('--help').stdout).toContain('reverse-architect analyze');
    expect(cli('--version').stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
