# MCP server

Atlas runs as a [Model Context Protocol](https://modelcontextprotocol.io) server, so a coding agent can ask architecture questions instead of reading every file:

- What does this codebase look like?
- Where are the circular dependencies?
- What breaks if I change `routes.ts`?

Analysis runs locally. Nothing is sent anywhere except a `git clone` when you pass a GitHub URL.

## Set up

**Claude Code**

```bash
claude mcp add reverse-architect -- npx -y reverse-architect mcp
```

**Codex**

```bash
codex mcp add reverse-architect -- npx -y reverse-architect mcp
```

**Cursor, Claude Desktop, Windsurf and other clients** take the same JSON:

```json
{
  "mcpServers": {
    "reverse-architect": {
      "command": "npx",
      "args": ["-y", "reverse-architect", "mcp"]
    }
  }
}
```

Cursor reads this from `.cursor/mcp.json` (per project) or `~/.cursor/mcp.json`. Claude Desktop reads it from `claude_desktop_config.json`.

To work from a clone of this repository instead of npm, use `"command": "npm", "args": ["run", "mcp", "-w", "backend", "--silent"]` with `cwd` set to the repository root.

Then ask your agent something like:

> Use reverse-architect to analyze this project. Are there circular dependencies, and which one should I break first?

## Tools

Every tool takes `target`: an absolute directory path or a `https://github.com/<owner>/<repo>` URL. The first call on a target analyzes it, which can take a minute on a large repository. Later calls in the same session reuse that analysis.

| Tool | Use it to | Notes |
|---|---|---|
| `analyze_project` | Get an overview: entry point, counts, coverage and its limitations, finding counts, top findings | `refresh: true` re-analyzes |
| `list_findings` | List findings with evidence and limitations | Filter by `kind`, `min_confidence` (default `medium`), `path`. Paged: `offset`, `limit` (default 20). |
| `get_finding` | Get one finding by id | |
| `search_symbols` | Find files, classes, interfaces and functions by name | Paged |
| `trace_dependencies` | Walk the graph from a node: `direction: "dependents"` or `"dependencies"` | `node` is a path, symbol name or id. An ambiguous name returns candidates instead of guessing. `depth` 1 to 5. |
| `read_source` | Read numbered lines of a file in the analyzed project | At most 400 lines per call. Paths that leave the project, including through symlinks, are refused. |
| `export_diagram` | Get a Mermaid flowchart of file dependencies | `max_nodes` (default 60) |

All tools are read-only. `analyze_project` is marked open-world because it may clone from GitHub.

## Design

- **Small answers first.** `analyze_project` returns counts and the top 10 findings, not the graph. Lists are paged and every page says whether there is more (`nextOffset`). The full graph is only available through `export_diagram` or the CLI's `export --format json`.
- **Evidence, not verdicts.** Each finding separates what was observed in the source from what was inferred, and lists what the analysis could not see. Agents are told to check both before acting.
- **Errors are tool results.** A bad path or an unknown node comes back as a tool error the agent can read and recover from, never as a protocol failure.
- **One code path.** The MCP tools and the CLI call the same query functions (`backend/src/query/`), so both always give the same answer.
