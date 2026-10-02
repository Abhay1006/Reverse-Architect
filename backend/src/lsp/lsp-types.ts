// ============================================================
//  Atlas — LSP Type Helpers
//  Minimal LSP types for our use case. We re-export key types
//  from vscode-languageserver-protocol and add our own helpers.
// ============================================================

export {
  SymbolKind,
  type DocumentSymbol,
  type Location,
  type Position,
  type Range,
  type TextDocumentIdentifier,
  type CallHierarchyItem,
  type CallHierarchyIncomingCall,
  type CallHierarchyOutgoingCall,
} from 'vscode-languageserver-protocol';

/** Convert a file system path to a file:// URI. */
export function pathToUri(filePath: string): string {
  // Ensure absolute path handling on all platforms
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

/** Convert a file:// URI back to a file system path. */
export function uriToPath(uri: string): string {
  if (uri.startsWith('file:///')) {
    // On macOS/Linux: file:///Users/... → /Users/...
    return decodeURIComponent(uri.slice(7));
  }
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice(7));
  }
  return decodeURIComponent(uri);
}
