// ============================================================
//  Next.js API Route — POST /api/analyze/github
//  Proxies GitHub URL analysis requests to the backend server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import https from 'https';
import { BACKEND_URL, backendUnreachable, clientHeaders, relayResponse } from '../../../lib/backend-proxy';

export async function POST(request: NextRequest) {
  let body: { url?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body is not valid JSON' }, { status: 400 });
  }

  try {

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" field' },
        { status: 400 },
      );
    }

    // Basic GitHub URL validation
    if (!body.url.includes('github.com')) {
      return NextResponse.json(
        { error: 'URL must be a GitHub repository' },
        { status: 400 },
      );
    }

    const bodyData = JSON.stringify({ url: body.url, sessionId: body.sessionId });
    const urlObj = new URL(`${BACKEND_URL}/api/analyze/github`);

    // node:http rather than fetch: an analysis can take longer than undici's
    // five-minute headers timeout.
    const transport = urlObj.protocol === 'https:' ? https : http;
    const backendRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = transport.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          ...clientHeaders(request),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyData),
        },
        timeout: 15 * 60 * 1000, // 15 minutes timeout
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode || 200, body: data });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request to backend timed out (15 minutes)'));
      });

      req.write(bodyData);
      req.end();
    });

    return relayResponse(backendRes.status, backendRes.body);
  } catch (err) {
    return backendUnreachable('/api/analyze/github', err);
  }
}
