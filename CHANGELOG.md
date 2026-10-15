# Changelog

All notable changes to this project are documented here. Entries from 0.1.0 onward are generated from [Conventional Commits](https://www.conventionalcommits.org) by release-please.

## [0.2.0](https://github.com/Abhay1006/Reverse-Architect/compare/v0.1.0...v0.2.0) (2026-10-15)


### Features

* add CLI tool for project parsing and improve type extraction logic in extractors ([e062969](https://github.com/Abhay1006/Reverse-Architect/commit/e062969f9fd7f0e32f25895ea5132896419ef330))
* CLI and MCP server with evidence-backed findings and an accuracy benchmark ([7dffcf1](https://github.com/Abhay1006/Reverse-Architect/commit/7dffcf114fb38dce9da79f72ffa3c3605ffe6431))
* enhance file node visualizations, implement focused node analysis sidebar, and update project metadata structures ([948da66](https://github.com/Abhay1006/Reverse-Architect/commit/948da661b48ff54563b43ce7a7c7a6e67d9208d4))
* implement Bug Hunter heuristic search tool and expand LSP import parser to support multiple programming languages ([50589d8](https://github.com/Abhay1006/Reverse-Architect/commit/50589d8d148ed075f82f234f1e32829bf3cad29d))
* implement CLI for project parsing and improve type extraction logic for cleaner output ([25bc0ff](https://github.com/Abhay1006/Reverse-Architect/commit/25bc0fffaf8a4b390a69dfe773ebd709414623a0))
* implement database schema parsing, add GroupNode/DatabaseNode components, and introduce rate limiting for analysis endpoints ([0f575fb](https://github.com/Abhay1006/Reverse-Architect/commit/0f575fbb1d9bf8f2414edf3dd9f69007aac35654))
* implement graph analysis algorithms and dagre-based layout engine ([5ba3e17](https://github.com/Abhay1006/Reverse-Architect/commit/5ba3e17eef3147cbcf0139058f3f1f0f2ad48c9a))
* implement graph construction logic, add DFS algorithm, and enable JS file parsing support ([cdba186](https://github.com/Abhay1006/Reverse-Architect/commit/cdba1862b34b3e19de9784e578b8cb7e125c41b0))
* implement MUI theme provider and migrate node components to Material UI components ([f1986ad](https://github.com/Abhay1006/Reverse-Architect/commit/f1986adc86cacc43af28eef86bbeb741c8c59b18))
* implement project upload and analysis interface with initial node types and state management ([3b7670f](https://github.com/Abhay1006/Reverse-Architect/commit/3b7670f9ab9a29a3707e29382455e5b237b5971d))
* implement React Flow serialization and update node label mapping in layout logic ([a623c36](https://github.com/Abhay1006/Reverse-Architect/commit/a623c36df3a2668646511336fd28636682e72e4c))
* implement static analysis engine for god objects, dead code, and design patterns with corresponding frontend integration ([e2f196f](https://github.com/Abhay1006/Reverse-Architect/commit/e2f196fd9ab23ab0b87c49d52baf925e36a172fc))
* implement top-down hierarchical tree layout with vertical handle alignment ([40bac54](https://github.com/Abhay1006/Reverse-Architect/commit/40bac5475e046a2a8894332e609d4fedefbaf0b1))
* implement ts-morph extractors for functions, imports, and interfaces with updated shared types ([83a3106](https://github.com/Abhay1006/Reverse-Architect/commit/83a31069421bf2f87d72dcc3747a04138d1f39ef))
* integrate line count metadata, improve graph layout positioning, and extend function parsing to include arrow functions ([b4a42fc](https://github.com/Abhay1006/Reverse-Architect/commit/b4a42fc8cd21eaaf500993d187bbeaa69ccb52a3))
* introduce complexity analysis, entry point detection, and enhanced UI components including folder tree and breadcrumbs ([44de6ef](https://github.com/Abhay1006/Reverse-Architect/commit/44de6ef90523f14aa35fef3f65b98cb73df60ae2))


### Bug Fixes

* configure HTTP and simple-git timeouts to prevent header timeouts ([fe0710d](https://github.com/Abhay1006/Reverse-Architect/commit/fe0710d0d9aef199b5feef150cf59fe128027d7f))
* coordinate edge opacity with node visibility to prevent dangling lines to hidden/faded nodes ([3215297](https://github.com/Abhay1006/Reverse-Architect/commit/3215297f338f560a8c574b9a131e5b3be9fde0d1))
* **github:** stop passing the ambient environment to git ([41f3539](https://github.com/Abhay1006/Reverse-Architect/commit/41f3539239b2c370f99286a758dcd299d5aa6926))
* load env files programmatically and gracefully fallback ([963f2b1](https://github.com/Abhay1006/Reverse-Architect/commit/963f2b16798fb6650b2656691cf97d26f5442176))
* prefix workspace scripts with npx and add root build script to resolve termux/prod execution errors ([372df0f](https://github.com/Abhay1006/Reverse-Architect/commit/372df0f074c3b9af993b1cffead39de72b2c008c))
* repair broken analysis contract, harden security, bound resources ([0c04484](https://github.com/Abhay1006/Reverse-Architect/commit/0c044845ec9f78f6fa8cd8f1d620bfd7a8958ee3))
* resolve typescript-language-server to cli.mjs and spawn via node to fix android/termux shebang error ([a64d4a3](https://github.com/Abhay1006/Reverse-Architect/commit/a64d4a3f5b3e7363ff48c70212722dbebeddd519))
* **security:** pin tsserver so analysed repos cannot run their own ([44ab0f5](https://github.com/Abhay1006/Reverse-Architect/commit/44ab0f5bf1adb6691838761c4a01caffd30a6e01))
* **termux:** keep LD_PRELOAD in the git environment allow-list ([0074c34](https://github.com/Abhay1006/Reverse-Architect/commit/0074c3445a8ed8ed775cd630efa505e1a396bc9a))
* use npx concurrently to avoid command not found errors on custom shell environments ([b3415da](https://github.com/Abhay1006/Reverse-Architect/commit/b3415da129f1a22c5a9ab92a71d019d1a108baf8))

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
