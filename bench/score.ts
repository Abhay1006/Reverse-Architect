// ============================================================
//  Scoring for the accuracy benchmark. Pure functions, shared by
//  bench/run.ts and the backend golden tests.
// ============================================================

import type { AnalysisResponse, Finding } from 'shared';

export interface Expected {
  description: string;
  cycles: string[][];
  unusedFiles: string[];
  patterns: { pattern: string; label: string }[];
}

export interface Score {
  expected: number;
  found: number;
  truePositives: number;
  precision: number | null;
  recall: number | null;
  missed: string[];
  spurious: string[];
}

function score(expected: string[], found: string[]): Score {
  const e = new Set(expected);
  const f = new Set(found);
  const tp = [...f].filter(x => e.has(x)).length;
  return {
    expected: e.size,
    found: f.size,
    truePositives: tp,
    precision: f.size ? tp / f.size : null,
    recall: e.size ? tp / e.size : null,
    missed: [...e].filter(x => !f.has(x)),
    spurious: [...f].filter(x => !e.has(x)),
  };
}

/** Findings a user sees by default (medium confidence and up). */
export const shown = (f: Finding) => f.confidence !== 'low';

function predictions(result: AnalysisResponse) {
  const fileOf = new Map(result.nodes.map(n => [n.id, n.data.filePath]));
  const cycles = result.findings
    .filter(f => f.kind === 'cycle' && shown(f))
    .map(f => [...new Set(f.nodeIds.map(id => fileOf.get(id) ?? id))].sort().join(' ↔ '));
  const unusedFiles = result.findings
    .filter(f => f.kind === 'dead-code' && shown(f))
    .flatMap(f => (f.nodeIds.length === 0 ? [f.evidence[0]?.location?.filePath ?? f.id] : f.nodeIds.filter(id => id.startsWith('file:')).map(id => fileOf.get(id)!)));
  const nodesById = new Map(result.nodes.map(n => [n.id, n]));
  const patterns = result.findings
    .filter(f => f.kind === 'pattern' && shown(f))
    .map(f => `${f.id.split(':')[1]}:${nodesById.get(f.nodeIds[0]!)?.data.label}`);
  return { cycles, unusedFiles, patterns };
}

/** Score one analysis against its labels. */
export function scoreCorpus(result: AnalysisResponse, expected: Expected) {
  const got = predictions(result);
  return {
    cycles: score(expected.cycles.map(c => [...c].sort().join(' ↔ ')), got.cycles),
    unusedFiles: score(expected.unusedFiles, got.unusedFiles),
    patterns: score(expected.patterns.map(p => `${p.pattern}:${p.label}`), got.patterns),
  };
}
