# CLI

```bash
npx reverse-architect analyze <target>
```

`<target>` is a directory or a `https://github.com/<owner>/<repo>` URL. A GitHub repository is shallow-cloned into a temporary directory and deleted afterwards. Set `GITHUB_TOKEN` to clone a private one. The token is sent as an HTTP header, never written into the clone.

To install the command permanently: `npm install --global reverse-architect`.

## Commands

| Command | Answers |
|---|---|
| `analyze <target>` | What is in this project? Entry point, node and edge counts, how files were parsed, finding counts, top findings, limitations. |
| `findings <target>` | List findings with evidence. Filter with `--kind`, `--min-confidence`, `--path`. |
| `cycles`, `hotspots`, `god-objects`, `dead-code`, `patterns` `<target>` | Shorthand for `findings --kind …` |
| `search <target> <query>` | Where is `<query>` defined? Files and symbols by name. Exact matches rank first. |
| `deps <target> <node>` | What does `<node>` depend on? Add `--dependents` for what depends on it, `--depth 3` to follow further. `<node>` is a file path, a symbol name or a node id. |
| `export <target>` | A Mermaid diagram of file dependencies, or `--format json` for the complete analysis. |
| `mcp` | Run as an MCP server over stdio. See [mcp.md](mcp.md). |

## Options

| Option | Default | |
|---|---|---|
| `--json` | off | Machine-readable output on stdout. Progress always goes to stderr, so `--json \| jq` is safe. |
| `--kind <kind>` | all | `cycle`, `hotspot`, `god-object`, `dead-code`, `pattern` |
| `--min-confidence <level>` | `medium` | `high`, `medium`, `low` |
| `--path <path>` | all | Findings in this file, or under this directory if it ends in `/` |
| `--limit <n>`, `--offset <n>` | 20, 0 | Paging. Output ends with the next `--offset` when there is more. |
| `--type <type>` | all | `search` only: `file`, `class`, `interface`, `function`, `database` |
| `--max-nodes <n>` | 60 | `export` only: keep the most-connected files |
| `--fail-on-findings` | off | Exit 1 when any finding matches. Use it in CI. |

Exit codes: `0` success, `1` findings matched with `--fail-on-findings`, `2` usage or runtime error.

## Examples

```bash
# Where are the import cycles, and why does Atlas think so?
npx reverse-architect cycles .

# Fail a CI job on any high-confidence circular dependency
npx reverse-architect cycles . --min-confidence high --fail-on-findings

# What breaks if I change this file?
npx reverse-architect deps . src/api/routes.ts --dependents --depth 2

# Everything in one directory, as JSON
npx reverse-architect findings . --path src/payments/ --min-confidence low --json

# A diagram for a design doc
npx reverse-architect export https://github.com/expressjs/express > express.mmd
```

## Output

Each finding prints its evidence and limitations:

```text
[HIGH] Circular dependency: src/models/order.ts → src/models/user.ts → src/models/order.ts
  id: cycle:file:src/models/order.ts|file:src/models/user.ts
  • order.ts imports user.ts (src/models/order.ts)
  • user.ts imports order.ts (src/models/user.ts)
```

`•` marks an observation, `→` an inference and `!` a limitation. See [findings.md](findings.md) for what each kind means and how confidence is assigned.
