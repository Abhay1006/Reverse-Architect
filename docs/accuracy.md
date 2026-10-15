# Accuracy

Atlas's findings are heuristics, and a heuristic is only as good as its measured hit rate. This page records how the rules score and how that score was obtained, so a change that makes them worse shows up as a number.

## The labelled corpus

[`bench/corpus/`](../bench/corpus) holds small projects whose correct answers are written down in each `expected.json`: which import cycles exist, which files are unused, and which design patterns are present.

| Corpus | What it tests |
|---|---|
| `ts-shop` | A TypeScript app with one import cycle, one orphaned file and one instance of each of the six patterns. `MoneyFormatter` is a negative control: it has `constructor` and `toJSON`, which an earlier observer rule misread. |
| `py-inventory` | The same questions in Python, through the regex text extractor: snake_case names (`get_instance`, `create_calculator`) and package `__init__.py` files. |
| `ts-traps` | Known blind spots. A page loaded only through `import()`, a cycle that closes only through `import type`, and a call that merely shares a name with a function in another file. The correct answer is *no* cycle and one unused file. |

Run it:

```bash
npm run bench              # median of 3 runs per corpus
npm run bench -- --json    # full results, including every miss
```

CI runs the benchmark on every pull request and posts the table to the job summary. The golden tests (`backend/test/corpus.test.ts`) fail on any miss or spurious finding.

## Results

Scored at the default visibility (medium confidence and above). P = precision, R = recall.

| Corpus | Extractor | Cycles P / R | Unused files P / R | Patterns P / R | Wall time (median) |
|---|---|---|---|---|---|
| py-inventory | text, 12 files | 100% / 100% | 100% / 100% | 100% / 100% | 3 ms |
| ts-shop | LSP, 15 files | 100% / 100% | 100% / 100% | 100% / 100% | 470 ms |
| ts-traps | LSP, 8 files | n/a (no cycles expected, none reported) | 100% / 100% | n/a | 438 ms |

Peak memory of the analysis process was 88 MB. The TypeScript language server runs as a separate child process and is not counted. Measured on Node 26, macOS arm64. Most of the LSP wall time is starting the language server.

### Read these numbers with care

**The corpus was written by the people tuning the rules.** `ts-shop` scored 100% on its first run. `py-inventory` and `ts-traps` did not, and each miss was fixed in the analyzer, not in the labels. Together they caught five real bugs:

- dynamic `import()` was ignored;
- a cycle through `import type` was reported as a runtime cycle;
- a root-level `main.py` entry point was reported as unused;
- `__init__.py` files were reported as unreachable;
- Python's `get_instance` was not recognised.

Even so, a perfect score on a corpus you wrote is evidence of consistency, not of general accuracy. The real-repository checks below are the better guide, and more independent labelled projects are the most valuable contribution you can make.

## Real repositories

Analyzed at the commits shown. Counts are findings at medium confidence or above, which is the default view.

| Repository | Files parsed | Graph scope | Cycles | Hotspots | Highly coupled | Possibly unused |
|---|---|---|---|---|---|---|
| [expressjs/express](https://github.com/expressjs/express) @ `a419aa7` | 141 | entry points (7 library files) | 0 | 5 | 1 | 0 |
| [axios/axios](https://github.com/axios/axios) @ `790b2ca` | 273 | all files ¹ | 0 | 25 | 10 | 1 |
| [sindresorhus/ky](https://github.com/sindresorhus/ky) @ `3541888` | 98 | all files ² | 0 | 4 | 10 | 0 |

¹ axios's `package.json` start script runs `sandbox/server.js`, which reaches 1 of 83 source files, so Atlas analyses every file and says why in `coverage.limitations`.
² ky's `exports` point at build output that isn't in the repository, so no entry point is detected.

What was checked by hand:

- **axios, unused file:** `lib/helpers/deprecatedMethod.js` is reported as possibly unused. Nothing in the repository references it: a true positive. An earlier version also flagged `lib/helpers/null.js`, which `package.json` swaps in through its `browser` field. Files named by `package.json` are now never reported.
- **ky, cycles:** 8 cycles exist only through `import type` links and are reported at low confidence as type-level cycles. Before that rule, 4 of them were reported as high-confidence circular dependencies.
- **Express, cycles:** 5 candidate cycles are all low confidence: call edges between files that never import each other (`res.render` matched to `app.render`), and `render ↔ tryRender` recursion inside one file.

Not checked: the absence of runtime cycles in these repositories was not verified independently, and the hotspot and coupling rankings are rankings, not defects.

Reproduce a row:

```bash
npx reverse-architect analyze https://github.com/axios/axios
```

## Adding a corpus

1. Create `bench/corpus/<name>/` with a small project, including its `package.json` or equivalent so entry points are detected the way they would be in real use.
2. Write `expected.json`:
   ```json
   {
     "description": "What this project tests and why.",
     "cycles": [["src/a.ts", "src/b.ts"]],
     "unusedFiles": ["src/old.ts"],
     "patterns": [{ "pattern": "singleton", "label": "Database" }]
   }
   ```
3. Run `npm run bench`. If Atlas gets it wrong, that is the interesting part: open an issue or fix the analyzer, never the labels.
