import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProjectDir } from '../src/api/analyzer-pipeline.js';
import { scoreCorpus, type Expected } from '../../bench/score.js';

// Golden tests: the real pipeline (language server included) over the
// labelled benchmark projects. Any miss or spurious finding fails.
const corpusDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../bench/corpus');
const corpora = fs.readdirSync(corpusDir).filter(n => fs.existsSync(path.join(corpusDir, n, 'expected.json')));

describe.each(corpora)('corpus %s', (name) => {
  it('matches its labels exactly', async () => {
    const dir = path.join(corpusDir, name);
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf-8')) as Expected;
    const scores = scoreCorpus(await analyzeProjectDir(dir), expected);
    for (const s of Object.values(scores)) {
      expect({ missed: s.missed, spurious: s.spurious }).toEqual({ missed: [], spurious: [] });
    }
  }, 60_000);
});
