# Repository guide for coding agents

Atlas (npm package: `reverse-architect`) analyses a codebase's architecture and reports findings with evidence. It ships as a web app (`frontend/`), a CLI and an MCP server (both in `backend/`).

## Layout

- `backend/src/lsp/`, `parser/`: extract files, symbols and imports. LSP for JS/TS, regex for other languages, schemas for SQL/Prisma.
- `backend/src/graph/`: builds the dependency graph and runs graph algorithms (cycles, degrees, layout).
- `backend/src/analyzers/`: god objects, dead code, hotspots and patterns. **`findings.ts` is the only place results are turned into Findings.**
- `backend/src/api/analyzer-pipeline.ts`: runs everything and produces the `AnalysisResponse`.
- `backend/src/query/`: read-only questions over an analysis. **The CLI (`cli.ts`) and MCP server (`mcp/server.ts`) are thin adapters over it.**
- `shared/types.ts`: the wire types. Change shapes there first.
- `bench/`: labelled corpus and scorer. `backend/test/corpus.test.ts` fails on any miss.

## Rules

- **Fix the producer.** A wrong cycle usually means a wrong import or edge. Fix the parser or graph builder, not the detector downstream.
- **Report uncertainty; never hide it.** Lower a finding's confidence and add a `limitations` entry instead of dropping it silently. Update `docs/findings.md` when a rule changes.
- **Never edit `bench/corpus/*/expected.json` to improve a score.**
- **Bump `ANALYZER_VERSION`** (`backend/src/analyzer-version.ts`) when the analysis output changes, so caches are invalidated.
- **User-supplied paths go through `backend/src/api/path-safety.ts`.** Analysed code is untrusted.
- **stdout is data in the CLI and MCP server.** Entry points import `stdio-guard.js` first; never write logs to stdout there.
- **Keep MCP answers small:** paged lists, summaries first.

## Commands

```bash
npm run check        # typecheck + lint + knip + unit tests (CI)
npm run bench        # accuracy against the labelled corpus
npm run test:e2e     # Playwright smoke test
npm run cli -- analyze bench/corpus/ts-shop
```

Use Conventional Commit subjects. `frontend/AGENTS.md` has notes specific to the Next.js version in use.
