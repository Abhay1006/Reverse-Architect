import { describe, it, expect, vi, afterEach } from 'vitest';
import { relayResponse, clientHeaders } from '../src/app/lib/backend-proxy';
import { analyzeGithub, AtlasApiError } from '../src/app/lib/atlas-api';
import { getAnalysisErrorMessage } from '../src/app/hooks/useAnalysis';

describe('relayResponse', () => {
  it('passes the backend JSON body and status through unchanged', async () => {
    const res = relayResponse(413, JSON.stringify({ error: 'Analysis failed', details: 'Repository is too large' }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Analysis failed', details: 'Repository is too large' });
  });

  it('wraps a non-JSON body as an error message', async () => {
    const res = relayResponse(502, 'Bad gateway');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Bad gateway' });
  });
});

describe('clientHeaders', () => {
  it('forwards the client address for per-user rate limiting', () => {
    const req = new Request('http://localhost/api/x', { headers: { 'x-forwarded-for': '203.0.113.7' } });
    expect(clientHeaders(req)).toEqual({ 'x-forwarded-for': '203.0.113.7' });
  });

  it('sends nothing when there is no forwarded address', () => {
    expect(clientHeaders(new Request('http://localhost/api/x'))).toEqual({});
  });
});

describe('analysis error messages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("show the backend's reason, not a generic failure", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Analysis failed', details: 'Repository is too large to analyze (5000 source files discovered).' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )));

    const err = await analyzeGithub('https://github.com/a/b').catch((e) => e);
    expect(err).toBeInstanceOf(AtlasApiError);
    expect(getAnalysisErrorMessage(err)).toBe(
      'Analysis failed (500): Repository is too large to analyze (5000 source files discovered).',
    );
  });
});
