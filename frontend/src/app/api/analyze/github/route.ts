// ============================================================
//  Next.js API Route — POST /api/analyze/github
//  Proxies GitHub URL analysis requests to the backend server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    const backendRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
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

    if (backendRes.status < 200 || backendRes.status >= 300) {
      return NextResponse.json(
        { error: 'Backend analysis failed', details: backendRes.body },
        { status: backendRes.status },
      );
    }

    const data = JSON.parse(backendRes.body);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/analyze/github] Proxy error:', err);
    return NextResponse.json(
      {
        error: 'Failed to connect to analysis backend',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
