# Changelog

All notable changes to this project are documented here. Entries from 0.1.0 onward are generated from [Conventional Commits](https://www.conventionalcommits.org) by release-please.

## 0.1.0 (unreleased)

### Features

* **CLI** (`npx reverse-architect`): `analyze`, `findings`, `cycles`, `hotspots`, `god-objects`, `dead-code`, `patterns`, `search`, `deps` and `export`. Readable or `--json` output, and `--fail-on-findings` for CI.
* **MCP server** (`reverse-architect mcp`) with seven read-only, paged tools: `analyze_project`, `list_findings`, `get_finding`, `search_symbols`, `trace_dependencies`, `read_source` and `export_diagram`.
* **Findings with evidence:** every result now separates observations from inferences and lists its limitations. Each analysis reports coverage: which extractor parsed each file, the graph scope, and run-wide caveats.
* **Hotspot detection:** complexity weighted by fan-in.
* **Builder, Strategy and Adapter detection.** These were previously claimed in the README but not implemented. Singleton, Factory and Observer matches now carry their reasons.
* **Dynamic `import()`, bare `require()` and `import type` are parsed.** Type-only cycles are reported separately from runtime cycles.
* **Files named in `package.json`** (`main`, `browser`, `exports`, `bin`) are never reported as unused.
* **Accuracy benchmark** (`npm run bench`): labelled corpora, golden tests, and results in [docs/accuracy.md](docs/accuracy.md).

### Bug fixes

* **Security:** the TypeScript language server is pinned to Atlas's own TypeScript. Previously, a repository that committed `node_modules/typescript/lib/tsserver.js` had that file executed during analysis.
* Observer detection matched any method containing "on" (`constructor`, `toJSON`).
* Entities imported by name but never called were reported as dead code.
* A root-level entry file (`main.py`) was reported as dead code; Python `__init__.py` files were reported as unreachable.
* When `package.json` points at build output or a dev server, entry-point scoping no longer reports most of the source as unreachable.
* Cycles through calls that merely share a name, and recursion inside one file, are no longer reported as circular dependencies.
* Text extractor: Go grouped `import ( … )` blocks were ignored; C#, Swift and Kotlin inheritance lists were misparsed; interface methods were reported as top-level functions; one import statement could be counted twice.
* Deploy workflow: the health-check step read `secrets` in an `if:`, which GitHub rejects.

### Documentation

* README rewritten with accurate feature claims. The Bug Hunter is described as what it is (keyword matching plus one hop of score spreading), not PageRank.
* Added CONTRIBUTING, SECURITY, AGENTS and LICENSE (MIT), plus docs for findings, the CLI, the MCP server and accuracy.
