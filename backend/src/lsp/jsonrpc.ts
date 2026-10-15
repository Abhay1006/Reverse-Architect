// ============================================================
//  Atlas — JSON-RPC Message Framing for LSP Communication
//  Handles the Content-Length based protocol used by LSP servers.
// ============================================================

/**
 * Encode a JSON-RPC message with Content-Length header.
 * 
 * LSP uses a simple HTTP-like framing:
 *   Content-Length: <byte-length>\r\n
 *   \r\n
 *   <JSON body>
 */
export function encodeMessage(body: object): Buffer {
  const json = JSON.stringify(body);
  const contentLength = Buffer.byteLength(json, 'utf-8');
  const header = `Content-Length: ${contentLength}\r\n\r\n`;
  return Buffer.concat([
    Buffer.from(header, 'ascii'),
    Buffer.from(json, 'utf-8'),
  ]);
}

/**
 * Streaming parser for JSON-RPC messages from an LSP server.
 * Accumulates chunks and emits complete messages via callback.
 */
export class MessageReader {
  private buffer = Buffer.alloc(0);
  private contentLength = -1;
  private onMessage: (msg: unknown) => void;

  constructor(onMessage: (msg: unknown) => void) {
    this.onMessage = onMessage;
  }

  /** Feed raw data from the server's stdout into the parser. */
  feed(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.tryParse();
  }

  private tryParse(): void {
    while (true) {
      // If we don't have a content length yet, look for the header
      if (this.contentLength === -1) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return; // Need more data

        const headerStr = this.buffer.subarray(0, headerEnd).toString('ascii');
        const match = headerStr.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Malformed header — skip past it
          this.buffer = this.buffer.subarray(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1]!, 10);
        this.buffer = this.buffer.subarray(headerEnd + 4);
      }

      // Check if we have enough data for the body
      if (this.buffer.length < this.contentLength) return; // Need more data

      // Extract the body
      const bodyStr = this.buffer.subarray(0, this.contentLength).toString('utf-8');
      this.buffer = this.buffer.subarray(this.contentLength);
      this.contentLength = -1;

      try {
        const msg = JSON.parse(bodyStr);
        this.onMessage(msg);
      } catch {
        // Skip malformed JSON
        console.error('[LSP] Failed to parse JSON-RPC message body');
      }
    }
  }
}
