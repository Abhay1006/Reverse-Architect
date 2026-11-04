import { describe, it, expect } from 'vitest';
import type { Finding } from 'shared';
import {
  countByKind,
  findingsToMarkdown,
  firstLocation,
  isIssue,
  meetsConfidence,
  sortFindings,
} from '../src/app/lib/findings';

const finding = (over: Partial<Finding>): Finding => ({
  id: over.id ?? `${over.kind}:x`,
  kind: 'cycle',
  title: 'A finding',
  nodeIds: [],
  confidence: 'high',
  evidence: [],
  limitations: [],
  ...over,
});

const cycle = finding({
  id: 'cycle:a|b',
  kind: 'cycle',
  title: 'Circular dependency: a.ts → b.ts → a.ts',
  nodeIds: ['file:a.ts', 'file:b.ts'],
  evidence: [
    { basis: 'observed', rule: 'cycle/import-edge', detail: 'a.ts imports b.ts', location: { filePath: 'src/a.ts', line: 3 } },
  ],
});
const unused = finding({
  id: 'dead-code:c',
  kind: 'dead-code',
  title: 'File not reachable: c.ts',
  confidence: 'medium',
  evidence: [{ basis: 'observed', rule: 'dead-code/unreachable', detail: 'no import chain leads here' }],
  limitations: ['It may be loaded by a dynamic import.'],
});
const lowPattern = finding({ id: 'pattern:p', kind: 'pattern', title: 'Singleton pattern: Db', confidence: 'low' });

describe('findings helpers', () => {
  it('orders issues by kind, then confidence, and puts patterns last', () => {
    const sorted = sortFindings([lowPattern, unused, cycle]);
    expect(sorted.map((f) => f.kind)).toEqual(['cycle', 'dead-code', 'pattern']);
  });

  it("keeps the backend's ranking within a kind", () => {
    const risky = finding({ id: 'hotspot:z', kind: 'hotspot', title: 'Hotspot: zeta (complexity 90)' });
    const mild = finding({ id: 'hotspot:a', kind: 'hotspot', title: 'Hotspot: alpha (complexity 12)' });
    expect(sortFindings([risky, mild])).toEqual([risky, mild]);
  });

  it('filters by minimum confidence, matching the CLI default of medium', () => {
    const all = [cycle, unused, lowPattern];
    expect(all.filter((f) => meetsConfidence(f, 'medium'))).toEqual([cycle, unused]);
    expect(all.filter((f) => meetsConfidence(f, 'low'))).toHaveLength(3);
    expect(all.filter((f) => meetsConfidence(f, 'high'))).toEqual([cycle]);
  });

  it('treats patterns as structure rather than issues', () => {
    expect(isIssue(cycle)).toBe(true);
    expect(isIssue(lowPattern)).toBe(false);
  });

  it('counts every kind, including zeroes', () => {
    expect(countByKind([cycle, unused])).toEqual({ cycle: 1, hotspot: 0, 'god-object': 0, 'dead-code': 1, pattern: 0 });
  });

  it('finds the first located evidence item', () => {
    expect(firstLocation(cycle)).toEqual({ filePath: 'src/a.ts', line: 3 });
    expect(firstLocation(unused)).toBeUndefined();
  });

  it('keeps evidence and limitations in the Markdown export', () => {
    const md = findingsToMarkdown([unused, cycle]);
    expect(md.indexOf('## Circular dependencies (1)')).toBeLessThan(md.indexOf('## Possibly unused (1)'));
    expect(md).toContain('- _observed_: a.ts imports b.ts (`src/a.ts:3`)');
    expect(md).toContain('Limitations:\n- It may be loaded by a dynamic import.');
    expect(md).toContain('Confidence: **medium**');
  });

  it('says so when there is nothing to export', () => {
    expect(findingsToMarkdown([])).toContain('No findings');
  });
});
