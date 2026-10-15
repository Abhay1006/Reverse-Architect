// ============================================================
//  Atlas-TS — LSP Server Manager
//  Spawns and manages the lifecycle of a Language Server process.
//  Communicates over stdio using JSON-RPC with Content-Length
//  framing. Handles initialize/shutdown handshake.
// ============================================================

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { createRequire } from 'module';
import { encodeMessage, MessageReader } from './jsonrpc.js';
import { pathToUri } from './lsp-types.js';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  method: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface LspManagerOptions {
  /** Path to the typescript-language-server binary. Auto-detected if not set. */
  serverBin?: string;
  /** Timeout in ms for individual LSP requests. Default: 30000. */
  requestTimeout?: number;
  /** Enable verbose JSON-RPC logging. Default: false. */
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
//  Manager
// ---------------------------------------------------------------------------

export class LspManager {
  private process: ChildProcess | null = null;
  private reader: MessageReader | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private initialized = false;
  private serverCapabilities: any = null;
  private options: Required<LspManagerOptions>;

  constructor(opts: LspManagerOptions = {}) {
    this.options = {
      serverBin: opts.serverBin ?? '',
      requestTimeout: opts.requestTimeout ?? 30_000,
      verbose: opts.verbose ?? false,
    };
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Start the LSP server and complete the initialize handshake.
   * 
   * @param rootPath Absolute path to the project root to analyze.
   * @returns The server capabilities from the initialize response.
   */
  async start(rootPath: string): Promise<any> {
    if (this.process) {
      throw new Error('LSP server already running. Call shutdown() first.');
    }

    const serverBin = this.resolveServerBin();

    this.log(`Spawning LSP server: ${serverBin}`);
    this.log(`Project root: ${rootPath}`);

    const isJs = serverBin.endsWith('.js') || serverBin.endsWith('.mjs');
    const spawnCmd = isJs ? process.execPath : serverBin;
    const spawnArgs = isJs ? [serverBin, '--stdio'] : ['--stdio'];

    this.process = spawn(spawnCmd, spawnArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Set up message reader on stdout
    this.reader = new MessageReader((msg) => this.handleMessage(msg));
    this.process.stdout!.on('data', (chunk: Buffer) => {
      this.reader!.feed(chunk);
    });

    // Log stderr for debugging
    this.process.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) this.log(`[LSP stderr] ${text}`);
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.log(`LSP server exited (code=${code}, signal=${signal})`);
      this.rejectAllPending(new Error(`LSP server exited unexpectedly (code=${code})`));
      this.process = null;
      this.initialized = false;
    });

    this.process.on('error', (err) => {
      console.error('[LSP] Process error:', err.message);
      this.rejectAllPending(err);
    });

    // Send initialize request
    const rootUri = pathToUri(rootPath);
    const initResult = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri,
      rootPath,
      // Pin tsserver to our own TypeScript. Left unset, the language server
      // prefers a `node_modules/typescript` found in (or above) the analysed
      // workspace — so a repository that commits a crafted tsserver.js would
      // get it executed. A valid explicit path takes precedence over that.
      initializationOptions: { tsserver: { path: bundledTsserverPath() } },
      capabilities: {
        textDocument: {
          documentSymbol: {
            hierarchicalDocumentSymbolSupport: true,
            symbolKind: {
              valueSet: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
            },
          },
          callHierarchy: {
            dynamicRegistration: false,
          },
          typeHierarchy: {
            dynamicRegistration: false,
          },
          references: {},
          hover: {
            contentFormat: ['plaintext', 'markdown'],
          },
          definition: {},
          synchronization: {
            didSave: true,
            didOpen: true,
            didClose: true,
          },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
      workspaceFolders: [
        { uri: rootUri, name: path.basename(rootPath) },
      ],
    });

    this.serverCapabilities = initResult.capabilities;

    // Send initialized notification (no response expected)
    this.sendNotification('initialized', {});

    this.initialized = true;
    this.log('LSP server initialized successfully');
    this.log(`Server capabilities: ${JSON.stringify(Object.keys(this.serverCapabilities || {}))}`);

    return this.serverCapabilities;
  }

  /**
   * Gracefully shut down the LSP server.
   */
  async shutdown(): Promise<void> {
    if (!this.process) return;

    try {
      // Send shutdown request
      await this.sendRequest('shutdown', null);
      // Send exit notification
      this.sendNotification('exit', null);
    } catch (err) {
      this.log(`Shutdown request failed: ${err}`);
    }

    // Force kill after a short delay if it hasn't exited
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.process) {
          this.log('Force-killing LSP server');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 3000);

      if (this.process) {
        this.process.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      } else {
        clearTimeout(timer);
        resolve();
      }
    });

    this.process = null;
    this.initialized = false;
    this.pendingRequests.clear();
  }

  /** Check if the server is running and initialized. */
  isReady(): boolean {
    return this.initialized && this.process !== null;
  }

  /** Get the server's capabilities (available after start). */
  getCapabilities(): any {
    return this.serverCapabilities;
  }

  // ── Request / Notification API ──────────────────────────────────────

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('LSP server not running'));
        return;
      }

      const id = ++this.requestId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request timed out: ${method} (id=${id})`));
        }
      }, this.options.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, method, timer });

      this.log(`→ Request [${id}] ${method}`);
      const encoded = encodeMessage(message);
      this.process.stdin.write(encoded);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  sendNotification(method: string, params: any): void {
    if (!this.process?.stdin?.writable) {
      this.log(`Cannot send notification: server not running`);
      return;
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.log(`→ Notification: ${method}`);
    const encoded = encodeMessage(message);
    this.process.stdin.write(encoded);
  }

  // ── Internal ────────────────────────────────────────────────────────

  private handleMessage(msg: any): void {
    // Response to a request
    if ('id' in msg && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        clearTimeout(pending.timer);

        if (msg.error) {
          this.log(`← Error [${msg.id}] ${pending.method}: ${JSON.stringify(msg.error)}`);
          pending.reject(new Error(`LSP error: ${msg.error.message} (code ${msg.error.code})`));
        } else {
          this.log(`← Response [${msg.id}] ${pending.method}`);
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Server-initiated notification (diagnostics, log messages, etc.)
    if (msg.method) {
      this.handleServerNotification(msg.method, msg.params);
      return;
    }

    // Server-initiated request (window/workDoneProgress/create, etc.)
    if ('id' in msg && msg.method) {
      // Respond with null to acknowledge
      this.respondToServerRequest(msg.id, null);
      return;
    }
  }

  private handleServerNotification(method: string, params: any): void {
    switch (method) {
      case 'window/logMessage':
        if (this.options.verbose) {
          this.log(`[Server] ${params?.message}`);
        }
        break;
      case 'textDocument/publishDiagnostics':
        // We don't need diagnostics for architecture analysis — ignore
        break;
      case '$/progress':
        // Progress notifications — ignore
        break;
      default:
        this.log(`[Server notification] ${method}`);
    }
  }

  private respondToServerRequest(id: number, result: any): void {
    if (!this.process?.stdin?.writable) return;
    const response = { jsonrpc: '2.0', id, result };
    this.process.stdin.write(encodeMessage(response));
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private resolveServerBin(): string {
    if (this.options.serverBin) return this.options.serverBin;

    // Try to resolve typescript-language-server CLI directly via ESM resolution
    try {
      const requireESM = createRequire(import.meta.url);
      return requireESM.resolve('typescript-language-server/lib/cli.mjs');
    } catch {
      // Fallback to searching node_modules/.bin relative to process.cwd()
      return path.resolve(
        process.cwd(),
        'node_modules',
        '.bin',
        'typescript-language-server'
      );
    }
  }

  private log(msg: string): void {
    if (this.options.verbose) {
      console.log(`[LspManager] ${msg}`);
    }
  }
}

/**
 * Absolute path to the tsserver shipped with Atlas's own `typescript`
 * dependency. Throws rather than letting the language server fall back to
 * a TypeScript inside the (untrusted) analysed project.
 */
export function bundledTsserverPath(): string {
  try {
    return createRequire(import.meta.url).resolve('typescript/lib/tsserver.js');
  } catch {
    throw new Error('Atlas\'s bundled TypeScript was not found; refusing to let the language server use one from the analysed project.');
  }
}
