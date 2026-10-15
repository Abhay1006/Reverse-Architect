# Contributing

Thanks for helping. Bug reports, labelled benchmark projects, analyzer fixes and UI work are all welcome.

## Set up

```bash
nvm use            # Node 22.12+, see .nvmrc
npm install        # all workspaces; also installs the git hooks
npm run dev        # API on :4000, web app on :3000
```

## Before you open a pull request

```bash
npm run check      # typecheck, lint, knip (dead code), unit tests: what CI runs
npm run bench      # if you touched an analyzer: did accuracy move?
npm run test:e2e   # if you touched the upload flow or the graph UI
```

The pre-commit hook lints staged files, and the pre-push hook runs the typecheck and knip.

Use [Conventional Commit](https://www.conventionalcommits.org) subjects (`feat:`, `fix:`, `docs:` …). Release notes are generated from them, and a `!` (`feat!:`) marks a breaking change.

## Changing an analyzer

1. **Start from a wrong answer.** Add the case to a corpus in [`bench/corpus/`](bench/corpus) or as a unit test, and watch it fail.
2. **Fix the producer, not the consumer.** If imports are parsed wrong, fix the parser (`backend/src/lsp/`), not the cycle detector. Findings are interpreted in one place, `backend/src/analyzers/findings.ts`; the web app, CLI and MCP server read them from there.
3. **Say what you can't see.** If a rule has a blind spot, put it in the finding's `limitations` and in [docs/findings.md](docs/findings.md). A finding that admits it may be wrong is more useful than one that is confidently wrong.
4. **Never edit `expected.json` to make a score go up.** If the labels themselves are wrong, explain why in the PR.

If the change alters the analysis output, bump `ANALYZER_VERSION` in `backend/src/analyzer-version.ts` so cached results are recomputed.

## Conventions

- **The API payload is defined once**, in `shared/types.ts` as `AnalysisResponse`. Both sides import it, so adding a field means adding it there first, never redeclaring the shape locally. `runGraphPipeline` is typed against it, so a missed field fails the build.
- **Filesystem paths from user input go through `backend/src/api/path-safety.ts`.** Cloned repositories are untrusted content. Don't hand-roll containment checks; extend that module and its tests.
- **Edge `type` is the React Flow renderer; `relation` is the architectural meaning** (`import` / `extends` / `implements` / `calls`). Filter on `relation`.
- **The CLI and MCP server are thin adapters** over `backend/src/query/`. Add a question there once, then expose it in both.
- **Anything that writes JSON to stdout imports `stdio-guard.js` first**, so progress logging can't corrupt it.
- UI styling uses MUI with the existing tokens in `globals.css`; server data goes through React Query. See [`frontend/README.md`](frontend/README.md).

## Keeping your fork up to date

An upstream repository cannot push into its forks; syncing is always started from the fork. Either:

- use GitHub's **Sync fork** button, or run `gh repo sync <you>/Reverse-Architect`; or
- automate it: copy [`.github/templates/sync-fork.yml`](.github/templates/sync-fork.yml) to `.github/workflows/sync-fork.yml` in your fork. It fast-forwards your default branch from upstream daily and can be run on demand. Actions must be enabled on the fork, and GitHub disables scheduled workflows on forks after 60 days of inactivity.

## Releasing (maintainers)

Merging to `main` keeps a release pull request up to date ([release-please](https://github.com/googleapis/release-please)). Merging that PR tags the release, updates `CHANGELOG.md` and publishes `reverse-architect` to npm. See the comments in `.github/workflows/release.yml` for the one-time npm setup.
