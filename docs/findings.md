# Findings

Every conclusion Atlas draws is a **finding**: a claim, the evidence behind it, and what the analysis could not check. A finding tells you where to look. It is not a verdict.

```jsonc
{
  "id": "cycle:file:src/models/order.ts|file:src/models/user.ts", // stable across runs
  "kind": "cycle",                    // cycle | hotspot | god-object | dead-code | pattern
  "title": "Circular dependency: src/models/order.ts → src/models/user.ts → src/models/order.ts",
  "nodeIds": ["file:src/models/order.ts", "file:src/models/user.ts"],
  "confidence": "high",               // high | medium | low
  "evidence": [
    { "basis": "observed", "rule": "cycle/import-edge", "detail": "order.ts imports user.ts",
      "location": { "filePath": "src/models/order.ts" } },
    { "basis": "observed", "rule": "cycle/import-edge", "detail": "user.ts imports order.ts",
      "location": { "filePath": "src/models/user.ts" } }
  ],
  "limitations": []
}
```

- **`basis: observed`** means it was read directly from the source: an import, a method name, a measured number.
- **`basis: inferred`** means it's a conclusion drawn from observations, such as "this matches the builder pattern".
- **`limitations`** lists what this particular finding couldn't account for. The analysis-wide caveats are in `coverage.limitations`.

The CLI and MCP server show `medium` confidence and above by default. Use `--min-confidence low` or `min_confidence: "low"` to see everything.

## Coverage

Every analysis also reports `coverage`: what was parsed, how, and what that means for the findings.

| Field | Meaning |
|---|---|
| `filesByAnalyzer` | Files parsed by the TypeScript language server (`lsp`), the regex text extractor (`text`, all non-JS/TS languages) or the SQL/Prisma schema parser (`schema`) |
| `graphScope` | `entry-points`: only files reachable by import from the detected entry points are in the graph. `all-files`: every parsed file is. |
| `entryFiles` | The entry points used |
| `limitations` | Run-wide caveats, such as how many files were parsed by regex and whether reachability could be trusted |

Entry points come from `package.json` (`main`, start scripts, framework conventions). Two safeguards keep them honest:

1. If the detected entry points reach **less than half** of the runtime source files, reachability is abandoned. This is common when `main` points at build output (`dist/`) or a dev server. The graph then covers every file, and unreachable files are not reported.
2. Files that a `package.json` names (`main`, `browser` replacements, `exports`, `bin`, …) are never reported as unused.

Tests, examples, docs, benchmarks, scripts and config files (`test/`, `test-d/`, `examples/`, `*.config.*`, `gulpfile.js`, …) are expected to sit outside the entry-point graph and are never reported as unused.

## Kinds

### `cycle`: circular dependency

Found by depth-first search over the dependency graph.

| Confidence | When |
|---|---|
| high | Every link is a value `import` |
| medium | A link is a call or inheritance edge whose files also import each other |
| low | The cycle closes only through `import type` links (a **type-level cycle**: erased at compile time, no runtime effect), it stays inside one file (mutual recursion), or a JS/TS call crosses into a file the caller never imports (almost always two functions that share a name) |

Runtime cycles are detected on the graph with `import type` edges removed, so a type-level cycle never hides a runtime one. The web UI's "Circular Deps" panel shows runtime cycles only.

### `hotspot`: complex and widely used

Ranks functions and classes by `complexity × (1 + fan-in)` and keeps the top 25 with complexity ≥ 10.

- **High:** complexity ≥ 20 and used by ≥ 3 others.
- **Medium:** everything else in the top 25.
- **Limitations:** complexity is estimated by counting decision keywords (`if`, `case`, `&&`, `?:`, …), not computed from a control-flow graph. No version-control history is used, so how often the code changes is unknown.

### `god-object`: highly coupled

Nodes whose total degree (in + out edges) exceeds 4.

- **Medium:** among the 10 most-connected nodes **and** degree > 12.
- **Low:** everything else.

Degree counts dependencies, not responsibilities: a shared types module is legitimately depended on by many files.

### `dead-code`: possibly unused

| Confidence | When |
|---|---|
| medium | A file that nothing imports, or a file not reachable from any entry point |
| low | A function, class or interface that nothing calls, extends or imports by name |

Entities rate lower because calls are matched by name within the parsed files, so calls through object properties, callbacks or dynamic dispatch can be missed. Neither level can see dynamic `import(variable)`, framework conventions (file-based routes, dependency injection, reflection) or consumers outside the repository.

### `pattern`: design pattern

Heuristics over member names and inheritance. Method bodies are not inspected. Names are compared regardless of convention (`getInstance` = `get_instance`). Only medium and high matches are reported.

| Pattern | High | Medium |
|---|---|---|
| Singleton | `getInstance()` + an `instance` field | `getInstance()` alone |
| Factory | `create*`/`make*` methods in a class named `*Factory` | ≥ 2 `create*`/`make*` methods |
| Builder | `build()` + ≥ 2 step methods (`withX`, `setX`, `addX`), or `build()` in a `*Builder` | `build()` + 1 step method |
| Observer | Subscribe (`subscribe`, `on`, `addListener`, …) **and** notify (`emit*`, `notify*`, `publish*`, …) methods | n/a (one half alone is dropped) |
| Strategy | An interface named `*Strategy`/`*Policy`/`*Algorithm` with ≥ 2 implementations | A single-method interface with ≥ 2 implementations |
| Adapter | A class named `*Adapter`/`*Wrapper` that implements or extends a type | The name alone |

## Accuracy

See [accuracy.md](accuracy.md) for how these rules score against labelled projects and real repositories.
