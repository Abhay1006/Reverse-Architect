// ============================================================
//  Atlas — LSP Client
//  High-level API wrapping LspManager. Provides clean methods
//  for querying document symbols, call hierarchy, references,
//  hover info, and definitions from the language server.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { LspManager, type LspManagerOptions } from './lsp-manager.js';
import { pathToUri, type DocumentSymbol, type Position, type Location, type CallHierarchyItem, type CallHierarchyOutgoingCall } from './lsp-types.js';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface LspClientOptions extends LspManagerOptions {
  /** File extensions to include. Default: ['.ts', '.tsx', '.js', '.jsx'] */
  extensions?: string[];
  /** Directories to exclude. Default: ['node_modules', '.git', 'dist', 'build', '.next'] */
  excludeDirs?: string[];
}

// ---------------------------------------------------------------------------
//  Client
// ---------------------------------------------------------------------------

export class LspClient {
  private manager: LspManager;
  private options: Required<LspClientOptions>;
  private rootPath = '';
  private openedFiles = new Set<string>();

  constructor(opts: LspClientOptions = {}) {
    this.manager = new LspManager(opts);
    this.options = {
      serverBin: opts.serverBin ?? '',
      requestTimeout: opts.requestTimeout ?? 30_000,
      verbose: opts.verbose ?? false,
      extensions: opts.extensions ?? [
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',  // JavaScript/TypeScript
        '.py', '.pyw',                                    // Python
        '.go',                                             // Go
        '.rs',                                             // Rust
        '.java',                                           // Java
        '.kt', '.kts',                                     // Kotlin
        '.swift',                                          // Swift
        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',        // C/C++
        '.cs',                                             // C#
        '.rb',                                             // Ruby
        '.php',                                            // PHP
        '.scala',                                          // Scala
        '.dart',                                           // Dart
        '.lua',                                            // Lua
        '.ex', '.exs',                                     // Elixir
      ],
      excludeDirs: opts.excludeDirs ?? [
        'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
        '__pycache__', '.pytest_cache', 'venv', 'env', '.venv',     // Python
        'target',                                                      // Rust / Java (Maven)
        'vendor',                                                      // Go / PHP / Ruby
        '.gradle', 'gradle',                                           // Java (Gradle)
        'bin', 'obj',                                                  // C# / .NET
        '.build', 'Pods',                                              // Swift / iOS
        '.dart_tool',                                                  // Dart
        '_deps', 'CMakeFiles',                                         // C/C++ CMake
      ],
    };
  }

  // ── Project Lifecycle ───────────────────────────────────────────────

  /**
   * Open a project: start the LSP server, discover files, and notify the
   * server about each file via textDocument/didOpen.
   * 
   * @returns Array of file paths that were opened.
   */
  async openProject(rootPath: string): Promise<string[]> {
    this.rootPath = rootPath;

    // Start the LSP server
    await this.manager.start(rootPath);

    // Discover project files
    const files = this.discoverFiles(rootPath);
    console.log(`[LspClient] Discovered ${files.length} source files`);

    // Open all files in the language server
    for (const filePath of files) {
      await this.openFile(filePath);
    }

    // Give the server a moment to process all files
    // typescript-language-server needs time to load the project
    await this.waitForServerReady();

    return files;
  }

  /**
   * Close the project and shut down the LSP server.
   */
  async close(): Promise<void> {
    // Close all open files
    for (const filePath of this.openedFiles) {
      try {
        this.manager.sendNotification('textDocument/didClose', {
          textDocument: { uri: pathToUri(filePath) },
        });
      } catch {
        // Ignore close errors during shutdown
      }
    }
    this.openedFiles.clear();

    await this.manager.shutdown();
  }

  /** Check if the client is connected and ready. */
  isReady(): boolean {
    return this.manager.isReady();
  }

  // ── Document Symbols ────────────────────────────────────────────────

  /**
   * Get hierarchical document symbols for a file.
   * Returns classes, interfaces, functions, variables, etc. with their
   * children (methods, properties) nested inside.
   */
  async getDocumentSymbols(filePath: string): Promise<DocumentSymbol[]> {
    const uri = pathToUri(filePath);
    try {
      const result = await this.manager.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri },
      });

      if (!result) return [];

      // The result could be DocumentSymbol[] (hierarchical) or SymbolInformation[] (flat)
      // We requested hierarchical support, so we should get DocumentSymbol[]
      return result as DocumentSymbol[];
    } catch (err) {
      console.error(`[LspClient] Failed to get symbols for ${filePath}:`, err);
      return [];
    }
  }

  // ── Call Hierarchy ──────────────────────────────────────────────────

  /**
   * Prepare a call hierarchy item at a given position.
   * This is step 1 of the call hierarchy protocol.
   */
  async prepareCallHierarchy(filePath: string, position: Position): Promise<CallHierarchyItem[]> {
    const uri = pathToUri(filePath);
    try {
      const result = await this.manager.sendRequest('textDocument/prepareCallHierarchy', {
        textDocument: { uri },
        position,
      });
      return result || [];
    } catch {
      return [];
    }
  }

  /**
   * Get outgoing calls from a call hierarchy item.
   * Returns what functions/methods this item calls.
   */
  async getOutgoingCalls(item: CallHierarchyItem): Promise<CallHierarchyOutgoingCall[]> {
    try {
      const result = await this.manager.sendRequest('callHierarchy/outgoingCalls', { item });
      return result || [];
    } catch {
      return [];
    }
  }

  // ── References ──────────────────────────────────────────────────────

  /**
   * Find all references to a symbol at a given position.
   */
  async getReferences(filePath: string, position: Position): Promise<Location[]> {
    const uri = pathToUri(filePath);
    try {
      const result = await this.manager.sendRequest('textDocument/references', {
        textDocument: { uri },
        position,
        context: { includeDeclaration: false },
      });
      return result || [];
    } catch {
      return [];
    }
  }

  // ── Definition ──────────────────────────────────────────────────────

  /**
   * Go to definition for a symbol at a given position.
   */
  async getDefinition(filePath: string, position: Position): Promise<Location[]> {
    const uri = pathToUri(filePath);
    try {
      const result = await this.manager.sendRequest('textDocument/definition', {
        textDocument: { uri },
        position,
      });

      if (!result) return [];
      // Could be a single Location or Location[]
      return Array.isArray(result) ? result : [result];
    } catch {
      return [];
    }
  }

  // ── Hover ───────────────────────────────────────────────────────────

  /**
   * Get hover information (type signature) for a symbol.
   */
  async getHoverInfo(filePath: string, position: Position): Promise<string | null> {
    const uri = pathToUri(filePath);
    try {
      const result = await this.manager.sendRequest('textDocument/hover', {
        textDocument: { uri },
        position,
      });

      if (!result?.contents) return null;

      // Hover contents can be a string, MarkedString, or MarkupContent
      if (typeof result.contents === 'string') return result.contents;
      if (result.contents.value) return result.contents.value;
      if (Array.isArray(result.contents)) {
        return result.contents
          .map((c: any) => (typeof c === 'string' ? c : c.value || ''))
          .join('\n');
      }

      return null;
    } catch {
      return null;
    }
  }

  // ── File Management ─────────────────────────────────────────────────

  /**
   * Notify the server that a file is open (textDocument/didOpen).
   */
  private async openFile(filePath: string): Promise<void> {
    if (this.openedFiles.has(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const languageId = this.getLanguageId(ext);

      this.manager.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: pathToUri(filePath),
          languageId,
          version: 1,
          text: content,
        },
      });

      this.openedFiles.add(filePath);
    } catch (err) {
      // File read error — skip
    }
  }

  /**
   * Recursively discover source files in the project directory.
   */
  discoverFiles(dir: string): string[] {
    const results: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!this.options.excludeDirs.includes(entry.name)) {
            results.push(...this.discoverFiles(fullPath));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (this.options.extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Directory read error — skip
    }

    return results;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private getLanguageId(ext: string): string {
    switch (ext) {
      case '.ts': return 'typescript';
      case '.tsx': return 'typescriptreact';
      case '.js': case '.mjs': case '.cjs': return 'javascript';
      case '.jsx': return 'javascriptreact';
      case '.py': case '.pyw': return 'python';
      case '.go': return 'go';
      case '.rs': return 'rust';
      case '.java': return 'java';
      case '.kt': case '.kts': return 'kotlin';
      case '.swift': return 'swift';
      case '.c': case '.h': return 'c';
      case '.cpp': case '.hpp': case '.cc': case '.cxx': return 'cpp';
      case '.cs': return 'csharp';
      case '.rb': return 'ruby';
      case '.php': return 'php';
      case '.scala': return 'scala';
      case '.dart': return 'dart';
      case '.lua': return 'lua';
      case '.ex': case '.exs': return 'elixir';
      default: return 'plaintext';
    }
  }

  /**
   * Wait for the server to finish initial project loading.
   * We do this by sending a trivial request and waiting for the response.
   */
  private async waitForServerReady(): Promise<void> {
    // Send a quick request to verify the server is responsive
    // after opening all files. The response confirms the project is loaded.
    const files = Array.from(this.openedFiles);
    if (files.length > 0) {
      // Try to get symbols for the first file as a readiness probe
      try {
        await this.getDocumentSymbols(files[0]!);
      } catch {
        // Server might still be loading — wait a bit
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /** Get the root path of the currently open project. */
  getRootPath(): string {
    return this.rootPath;
  }

  /** Get all currently opened file paths. */
  getOpenedFiles(): string[] {
    return Array.from(this.openedFiles);
  }
}
