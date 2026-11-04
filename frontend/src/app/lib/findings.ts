// ============================================================
//  Findings helpers for the web app: labels, ordering, filtering
//  and a Markdown export. Pure functions so they can be unit tested.
//  The findings themselves are produced only by the backend
//  (backend/src/analyzers/findings.ts); nothing here re-derives them.
// ============================================================

import type { Confidence, Finding, FindingKind } from 'shared';

export interface FindingKindMeta {
  label: string;
  /** Short explanation of what the rule looks for, shown under the label. */
  blurb: string;
  color: string;
}

export const FINDING_KINDS: Record<FindingKind, FindingKindMeta> = {
  cycle: {
    label: 'Circular dependencies',
    blurb: 'Files that import each other, directly or through a chain.',
    color: '#ef4444',
  },
  hotspot: {
    label: 'Hotspots',
    blurb: 'Complex code that many other parts depend on.',
    color: '#f59e0b',
  },
  'god-object': {
    label: 'Highly coupled',
    blurb: 'Files and classes far more connected than the rest of the codebase.',
    color: '#f97316',
  },
  'dead-code': {
    label: 'Possibly unused',
    blurb: 'Code that nothing imports or that no entry point reaches.',
    color: '#94a3b8',
  },
  pattern: {
    label: 'Design patterns',
    blurb: 'Recognised structures, with the observations that matched.',
    color: '#0ea5e9',
  },
};

/** Display order: the most actionable problems first, patterns last. */
export const KIND_ORDER: FindingKind[] = ['cycle', 'hotspot', 'god-object', 'dead-code', 'pattern'];

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export const CONFIDENCE_COLORS: Record<Confidence, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#94a3b8',
};

/** Patterns describe structure; everything else is something to look at. */
export function isIssue(finding: Finding): boolean {
  return finding.kind !== 'pattern';
}

export function meetsConfidence(finding: Finding, min: Confidence): boolean {
  return CONFIDENCE_RANK[finding.confidence] <= CONFIDENCE_RANK[min];
}

/**
 * Group by kind and confidence. Within a group the backend's order is kept
 * (the sort is stable): it already ranks hotspots by risk and coupling by degree.
 */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence],
  );
}

export function countByKind(findings: readonly Finding[]): Record<FindingKind, number> {
  const counts: Record<FindingKind, number> = { cycle: 0, hotspot: 0, 'god-object': 0, 'dead-code': 0, pattern: 0 };
  for (const f of findings) counts[f.kind]++;
  return counts;
}

/** The first source location a finding points at, if any (for "View code"). */
export function firstLocation(finding: Finding): { filePath: string; line?: number } | undefined {
  return finding.evidence.find((e) => e.location)?.location;
}

/**
 * Render findings as Markdown, e.g. for a pull request description or an
 * issue. Evidence and limitations are kept: a finding without them is a
 * verdict, and Atlas only makes claims to check.
 */
export function findingsToMarkdown(findings: readonly Finding[], title = 'Atlas architecture findings'): string {
  const lines: string[] = [`# ${title}`, ''];
  if (findings.length === 0) {
    lines.push('No findings at the selected confidence.');
    return lines.join('\n');
  }
  for (const kind of KIND_ORDER) {
    const ofKind = sortFindings(findings.filter((f) => f.kind === kind));
    if (ofKind.length === 0) continue;
    lines.push(`## ${FINDING_KINDS[kind].label} (${ofKind.length})`, '');
    for (const f of ofKind) {
      lines.push(`### ${f.title}`, '', `Confidence: **${f.confidence}**`, '');
      for (const e of f.evidence) {
        const where = e.location ? ` (\`${e.location.filePath}${e.location.line ? `:${e.location.line}` : ''}\`)` : '';
        lines.push(`- _${e.basis}_: ${e.detail}${where}`);
      }
      if (f.limitations.length > 0) {
        lines.push('', 'Limitations:');
        for (const l of f.limitations) lines.push(`- ${l}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}
