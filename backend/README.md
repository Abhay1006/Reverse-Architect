# reverse-architect

Architecture analysis for a codebase, from the terminal or your coding agent. It reports:
- circular dependencies;
- hotspots;
- highly coupled modules;
- possibly unused code;
- design patterns.

Each finding comes with the evidence behind it and what the analysis could not see.

```bash
npx reverse-architect analyze .
npx reverse-architect cycles . --fail-on-findings
npx reverse-architect deps . src/app.ts --dependents
npx reverse-architect analyze https://github.com/expressjs/express
```

```text
[HIGH] Circular dependency: src/models/order.ts → src/models/user.ts → src/models/order.ts
  id: cycle:file:src/models/order.ts|file:src/models/user.ts
  • order.ts imports user.ts (src/models/order.ts)
  • user.ts imports order.ts (src/models/user.ts)
```

## As an MCP server

```bash
claude mcp add reverse-architect -- npx -y reverse-architect mcp
```

Or add it to any MCP client:

```json
{ "mcpServers": { "reverse-architect": { "command": "npx", "args": ["-y", "reverse-architect", "mcp"] } } }
```

There are seven read-only tools: `analyze_project`, `list_findings`, `get_finding`, `search_symbols`, `trace_dependencies`, `read_source` and `export_diagram`. Lists are paged and overviews come first, to keep agent context small.

## Languages

JavaScript and TypeScript go through the TypeScript language server. Python, Go, Java, Kotlin, Rust, C/C++, C#, Ruby, PHP, Swift, Scala, Dart, Lua and Elixir go through a regex extractor, which gives rougher results. Every analysis reports which extractor handled each file.

Requires Node.js 20.12+ and `git` (for GitHub URLs).

## Documentation

- [CLI reference](https://github.com/Abhay1006/Reverse-Architect/blob/main/docs/cli.md)
- [MCP server](https://github.com/Abhay1006/Reverse-Architect/blob/main/docs/mcp.md)
- [How findings and confidence work](https://github.com/Abhay1006/Reverse-Architect/blob/main/docs/findings.md)
- [Measured accuracy](https://github.com/Abhay1006/Reverse-Architect/blob/main/docs/accuracy.md)

This package also contains the web app's API server. The full project, with the interactive 2D/3D graph, is at [github.com/Abhay1006/Reverse-Architect](https://github.com/Abhay1006/Reverse-Architect).

MIT licensed.
