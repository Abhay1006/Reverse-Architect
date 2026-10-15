import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import request from 'supertest';
import type { Express } from 'express';
import type { AnalysisResponse } from 'shared';
import { ANALYZER_VERSION } from '../src/analyzer-version.js';

// Configuration is read at import time, so point the cache and the clone
// workspace at a temporary directory before the app is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-routes-'));
process.env.ATLAS_DB_PATH = path.join(tmpRoot, 'cache.db');
process.env.ATLAS_CLONES_DIR = path.join(tmpRoot, 'clones');
process.env.ATLAS_UPLOAD_MAX_UNCOMPRESSED_BYTES = String(64 * 1024);
process.env.ATLAS_UPLOAD_MAX_ENTRIES = '50';
process.env.ALLOWED_ORIGINS = 'http://allowed.example';

let app: Express;
let CacheManager: typeof import('../src/cache/cache-manager.js').CacheManager;

beforeAll(async () => {
  ({ CacheManager } = await import('../src/cache/cache-manager.js'));
  const { createApp } = await import('../src/app.js');
  app = createApp();
});

afterAll(() => {
  CacheManager.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

/** Build a zip in memory from `{ entryName: contents }`. */
function zipOf(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

describe('error contract', () => {
  it('answers /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('answers unknown API routes with JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('rejects malformed JSON with a JSON 400, not an HTML page', async () => {
    const res = await request(app)
      .post('/api/analyze/github')
      .set('Content-Type', 'application/json')
      .send('{"url":');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toMatch(/not valid JSON/);
  });

  it('rejects a disallowed CORS origin with a JSON 403', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CORS/);
  });

  it('allows an allow-listed CORS origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://allowed.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.example');
  });
});

describe('POST /api/analyze/github validation', () => {
  it('rejects a missing url', async () => {
    const res = await request(app).post('/api/analyze/github').send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-GitHub and malformed URLs', async () => {
    for (const url of ['https://gitlab.com/a/b', 'https://github.com/only-owner', 'https://github.com/a/b/tree/main']) {
      const res = await request(app).post('/api/analyze/github').send({ url });
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /api/analyze/github/cached', () => {
  it('finds a cached result under any spelling of the repository', async () => {
    const result: AnalysisResponse = {
      nodes: [], edges: [],
      analysis: { godObjects: [], deadCode: [], cycles: [], patterns: [] },
      godObjectDetails: [], deadCodeDetails: [], entryPoint: null,
      findings: [],
      coverage: {
        filesByAnalyzer: { lsp: 0, text: 0, schema: 0, unknown: 0 },
        filesParsed: 0, filesInGraph: 0, graphScope: 'all-files', entryFiles: [], limitations: [],
      },
      analyzerVersion: ANALYZER_VERSION,
    };
    CacheManager.saveResult('octo/widget', 'https://github.com/octo/widget', 'a'.repeat(40), result);

    const res = await request(app).get('/api/analyze/github/cached').query({ repoId: 'Octo/Widget.git' });
    expect(res.status).toBe(200);
    expect(res.body.repoId).toBe('octo/widget');
  });

  it('rejects traversal in repoId', async () => {
    const res = await request(app).get('/api/analyze/github/cached').query({ repoId: '../../etc' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/analyze/upload', () => {
  it('requires a file', async () => {
    const res = await request(app).post('/api/analyze/upload');
    expect(res.status).toBe(400);
  });

  it('accepts only .zip files (case-insensitively)', async () => {
    const res = await request(app).post('/api/analyze/upload').attach('file', Buffer.from('hi'), 'notes.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/\.zip/);
  });

  it('refuses an archive that expands past the size budget (zip bomb)', async () => {
    const res = await request(app)
      .post('/api/analyze/upload')
      .attach('file', zipOf({ 'big.txt': 'x'.repeat(200 * 1024) }), 'bomb.ZIP');
    expect(res.status).toBe(413);
    expect(res.body.details).toMatch(/over the .* limit/);
  });

  it('refuses an archive with too many entries', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 60; i++) files[`f${i}.txt`] = 'x';
    const res = await request(app).post('/api/analyze/upload').attach('file', zipOf(files), 'many.zip');
    expect(res.status).toBe(413);
    expect(res.body.details).toMatch(/too many entries/);
  });

  it('refuses Zip Slip entries with a 400', async () => {
    // adm-zip normalizes names in addFile, so write the traversal name into the header directly.
    const zip = new AdmZip();
    zip.addFile('placeholder.txt', Buffer.from('x'));
    zip.getEntries()[0]!.entryName = '../../escape.txt';
    const res = await request(app).post('/api/analyze/upload').attach('file', zip.toBuffer(), 'slip.zip');
    expect(res.status).toBe(400);
    expect(fs.existsSync(path.join(tmpRoot, 'escape.txt'))).toBe(false);
  });

  it('maps an oversized upload to a JSON 413', async () => {
    const res = await request(app)
      .post('/api/analyze/upload')
      .attach('file', Buffer.alloc(51 * 1024 * 1024), 'huge.zip');
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/);
  });

  it('analyzes a project, mints an unguessable id, and serves its files to Code Peek', async () => {
    const res = await request(app)
      .post('/api/analyze/upload')
      .attach('file', zipOf({
        'proj/package.json': JSON.stringify({ name: 'proj', main: 'src/index.js' }),
        'proj/src/index.js': "import { greet } from './greet.js';\ngreet();\n",
        'proj/src/greet.js': 'export function greet() { return 1; }\n',
      }), 'proj.zip');

    expect(res.status).toBe(200);
    expect(res.body.repoId).toMatch(/^upload-[0-9a-f-]{36}$/);
    expect(res.body.nodes.length).toBeGreaterThan(0);

    const code = await request(app).get('/api/code').query({ repoId: res.body.repoId, filePath: 'src/greet.js' });
    expect(code.status).toBe(200);
    expect(code.body.code).toContain('export function greet');

    const escape = await request(app).get('/api/code').query({ repoId: res.body.repoId, filePath: '../../cache.db' });
    expect(escape.status).toBe(404);
  }, 60_000);
});

describe('GET /api/code validation', () => {
  it('rejects missing and invalid parameters', async () => {
    expect((await request(app).get('/api/code')).status).toBe(400);
    expect((await request(app).get('/api/code').query({ repoId: '../x', filePath: 'a' })).status).toBe(400);
    // Old enumerable timestamp ids are no longer accepted.
    expect((await request(app).get('/api/code').query({ repoId: 'upload-1700000000000', filePath: 'a' })).status).toBe(400);
  });
});

describe('GET /api/analyze/progress', () => {
  it('requires a sessionId', async () => {
    const res = await request(app).get('/api/analyze/progress');
    expect(res.status).toBe(400);
  });
});

describe('AI routes', () => {
  it('requires provider credentials', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'hi', repoUrl: 'https://github.com/a/b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/x-ai-api-key/);
  });

  it('rejects unknown providers', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-ai-provider', 'mystery')
      .set('x-ai-api-key', 'k')
      .send({ message: 'hi', repoUrl: 'https://github.com/a/b' });
    expect(res.status).toBe(400);
  });

  it('rejects a traversal repoUrl', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-ai-provider', 'openai')
      .set('x-ai-api-key', 'k')
      .send({ message: 'hi', repoUrl: 'local://../../etc' });
    expect(res.status).toBe(400);
  });

  it('does not ask GitHub for issues of an uploaded project', async () => {
    const res = await request(app).get('/api/ai/issues').query({ repoUrl: 'local://upload-0b5f8f9e-1c2d-4e3f-8a9b-0c1d2e3f4a5b' });
    expect(res.status).toBe(400);
  });
});
