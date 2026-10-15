// ============================================================
//  Atlas — stdout guard
//  Import this FIRST in any entry point whose stdout is a data
//  channel (CLI JSON output, MCP over stdio). The analysis modules
//  log progress with console.log; this sends that to stderr so it
//  can never corrupt the machine-readable stream.
// ============================================================

console.log = console.error;
console.info = console.error;
console.debug = console.error;
console.warn = console.error;
