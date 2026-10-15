# Security

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/Abhay1006/Reverse-Architect/security/advisories/new), not in a public issue. Include what you found, how to reproduce it, and the impact you expect.

You can expect an acknowledgement within a week. Fixes for confirmed issues are released as soon as they are ready, and you'll be credited unless you prefer otherwise.

## What Atlas trusts, and what it doesn't

Atlas reads code it did not write: uploaded archives and cloned repositories are **untrusted input**.

- **Analysis does not execute the analysed code.** It is parsed as text and through the TypeScript language server. The language server is pinned to Atlas's own TypeScript, because by default it would load a `node_modules/typescript` found inside the analysed project. `backend/test/lsp-isolation.test.ts` plants such a copy and checks that it never runs.
- **Every user-supplied path goes through `backend/src/api/path-safety.ts`.** That covers zip entries, Code Peek requests and the MCP `read_source` tool. Symlinks are resolved before containment is checked, so a repository cannot read files outside itself, and zip extraction is protected against Zip Slip.
- **Only `https://github.com/<owner>/<repo>` URLs are cloned.** Clones are shallow and run with an allow-listed environment, never your shell's environment.
- **`GITHUB_TOKEN` is sent as an HTTP header** and never written into a clone's `.git/config`.
- **AI provider keys are supplied per request** by the browser and are never stored.

The web API has **no authentication** and binds to `127.0.0.1` by default. See "Security notes" in the [README](README.md#security-notes) before exposing it on a network.

The CLI and MCP server run with your user's permissions on your machine. `read_source` can read any file inside the target you point it at.
