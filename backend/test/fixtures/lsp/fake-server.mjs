// A minimal language server for tests. Before answering `initialize` it sends
// the client a server-initiated request (workspace/configuration) and waits
// for the reply — so `initialize` only resolves if the client answers it.

let buffer = Buffer.alloc(0);
let pendingInitializeId = null;

function send(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

function handle(msg) {
  if (msg.method === 'initialize') {
    pendingInitializeId = msg.id;
    send({ jsonrpc: '2.0', id: 'server-req-1', method: 'workspace/configuration', params: { items: [] } });
  } else if (msg.id === 'server-req-1' && !msg.method) {
    send({ jsonrpc: '2.0', id: pendingInitializeId, result: { capabilities: {} } });
  } else if (msg.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: msg.id, result: null });
  } else if (msg.method === 'exit') {
    process.exit(0);
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const length = parseInt(/Content-Length:\s*(\d+)/i.exec(buffer.subarray(0, headerEnd).toString())[1], 10);
    if (buffer.length < headerEnd + 4 + length) return;
    const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString();
    buffer = buffer.subarray(headerEnd + 4 + length);
    handle(JSON.parse(body));
  }
});
