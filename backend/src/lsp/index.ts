// ============================================================
//  Atlas — LSP Module Barrel Export
// ============================================================

export { LspManager, shutdownAllLspServers, type LspManagerOptions } from './lsp-manager.js';
export { LspClient, type LspClientOptions } from './lsp-client.js';
export { analyzeWithLsp } from './lsp-extractors.js';
export { adaptSymbolsToParsedFile, extractImportsFromSource, clearFileCache } from './lsp-adapter.js';
export { estimateComplexity, estimateComplexityFromText } from './lsp-complexity.js';
export { pathToUri, uriToPath } from './lsp-types.js';
export { detectProjectLanguage, detectLang, analyzeFileWithText } from './text-analyzer.js';

