// ============================================================
//  Reverse Architect — accuracy & cost benchmark
//
//  Runs the real analysis pipeline over every labelled project in
//  bench/corpus/ and scores it against that project's expected.json:
//  precision/recall for cycles, unused files and design patterns,
//  plus wall time, CPU time and peak memory.
//
//  Usage: npm run bench [-- --runs 3] [-- --json]
// ============================================================

import '../backend/src/stdio-guard.js';
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';
import type { AnalysisResponse } from 'shared';
import { analyzeProjectDir } from '../backend/src/api/analyzer-pipeline.js';
import { scoreCorpus, shown, type Expected, type Score } from './score.js';

interface CorpusResult {
  name: string;
  description: string;
  analyzers: AnalysisResponse['coverage']['filesByAnalyzer'];
  scores: { cycles: Score; unusedFiles: Score; patterns: Score };
  /** Low-confidence dead-code findings: shown only on request, not scored. */
  lowConfidenceDeadCode: number;
  wallMs: number[];
  cpuMs: number[];
  peakRssMb: number;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.join(here, 'corpus');

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);

async function runCorpus(name: string, runs: number): Promise<CorpusResult> {
  const dir = path.join(corpusDir, name);
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf-8')) as Expected;
  const wallMs: number[] = [];
  const cpuMs: number[] = [];
  let result: AnalysisResponse | undefined;

  for (let i = 0; i < runs; i++) {
    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    result = await analyzeProjectDir(dir);
    wallMs.push(performance.now() - t0);
    const cpu = process.cpuUsage(cpu0);
    cpuMs.push((cpu.user + cpu.system) / 1000);
  }

  return {
    name,
    description: expected.description,
    analyzers: result!.coverage.filesByAnalyzer,
    scores: scoreCorpus(result!, expected),
    lowConfidenceDeadCode: result!.findings.filter(f => f.kind === 'dead-code' && !shown(f)).length,
    wallMs,
    cpuMs,
    peakRssMb: process.resourceUsage().maxRSS / 1024,
  };
}

function markdown(results: CorpusResult[]): string {
  const rows = ['| Corpus | Extractor | Cycles P / R | Unused files P / R | Patterns P / R | Low-conf. dead code | Wall (median) | CPU (median) |',
    '|---|---|---|---|---|---|---|---|'];
  for (const r of results) {
    const s = r.scores;
    const extractor = Object.entries(r.analyzers).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
    rows.push(`| ${r.name} | ${extractor} | ${pct(s.cycles.precision)} / ${pct(s.cycles.recall)} | ` +
      `${pct(s.unusedFiles.precision)} / ${pct(s.unusedFiles.recall)} | ${pct(s.patterns.precision)} / ${pct(s.patterns.recall)} | ` +
      `${r.lowConfidenceDeadCode} | ${Math.round(median(r.wallMs))} ms | ${Math.round(median(r.cpuMs))} ms |`);
  }
  const misses = results.flatMap(r => Object.entries(r.scores).flatMap(([k, s]) => [
    ...s.missed.map(m => `- ${r.name} / ${k}: **missed** ${m}`),
    ...s.spurious.map(m => `- ${r.name} / ${k}: **spurious** ${m}`),
  ]));
  return [...rows, '', misses.length ? misses.join('\n') : 'No misses or spurious findings.'].join('\n');
}

async function main() {
  const { values } = parseArgs({ options: { runs: { type: 'string', default: '3' }, json: { type: 'boolean' } } });
  const runs = Math.max(1, Number(values.runs) || 3);
  const names = fs.readdirSync(corpusDir).filter(n => fs.existsSync(path.join(corpusDir, n, 'expected.json'))).sort();
  const results: CorpusResult[] = [];
  for (const name of names) {
    process.stderr.write(`benchmarking ${name} (${runs} runs)...\n`);
    results.push(await runCorpus(name, runs));
  }
  const peak = Math.max(...results.map(r => r.peakRssMb));
  process.stdout.write(values.json
    ? JSON.stringify({ node: process.version, platform: `${process.platform}-${process.arch}`, results }, null, 2) + '\n'
    : `${markdown(results)}\n\nPeak RSS of the analysis process: ${Math.round(peak)} MB ` +
      `(the TypeScript language server runs as a child process and is not included). ` +
      `Node ${process.version}, ${process.platform}-${process.arch}, ${runs} run(s) per corpus.\n`);
}

main().catch(err => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exitCode = 2;
});
