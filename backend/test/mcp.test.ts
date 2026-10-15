import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAtlasMcpServer } from '../src/mcp/server.js';

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../bench/corpus/py-inventory');

let client: Client;
let dispose: () => void;

async function call(name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: { target, ...args } });
  const text = (res.content as { type: string; text: string }[])[0]!.text;
  return { isError: res.isError === true, text, json: () => JSON.parse(text) };
}

beforeAll(async () => {
  const created = createAtlasMcpServer();
  dispose = created.dispose;
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await created.server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
  dispose();
});

describe('MCP server', () => {
  it('advertises the read-only tool set', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'analyze_project', 'export_diagram', 'get_finding', 'list_findings', 'read_source', 'search_symbols', 'trace_dependencies',
    ]);
    expect(tools.find(t => t.name === 'read_source')?.annotations?.readOnlyHint).toBe(true);
  });

  it('answers a typical investigation', async () => {
    const overview = (await call('analyze_project', {})).json();
    expect(overview.findingCounts.cycle).toEqual({ high: 1 });

    const cycles = (await call('list_findings', { kind: 'cycle' })).json();
    expect(cycles.items[0].evidence.length).toBeGreaterThan(0);

    const finding = (await call('get_finding', { id: cycles.items[0].id })).json();
    expect(finding.id).toBe(cycles.items[0].id);

    const hits = (await call('search_symbols', { query: 'Registry' })).json();
    expect(hits.items[0]).toMatchObject({ label: 'Registry', type: 'class' });

    const deps = (await call('trace_dependencies', { node: 'inventory/app.py', direction: 'dependencies' })).json();
    expect(deps.items.map((n: { filePath: string }) => n.filePath)).toContain('inventory/models.py');

    const src = (await call('read_source', { file: 'inventory/models.py', start_line: 1, end_line: 1 })).json();
    expect(src.text).toBe('1  from inventory.warehouse import Warehouse');

    expect((await call('export_diagram', {})).text).toMatch(/^flowchart LR/);
  });

  it('reports errors as tool errors, not protocol failures', async () => {
    expect((await call('read_source', { file: '../../../../etc/passwd' })).isError).toBe(true);
    expect((await call('trace_dependencies', { node: 'nope', direction: 'dependents' })).text).toMatch(/search_symbols/);
    const bad = await client.callTool({ name: 'analyze_project', arguments: { target: '/definitely/not/here' } });
    expect(bad.isError).toBe(true);
  });
});
