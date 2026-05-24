// ============================================================
//  Next.js API Route — POST /api/analyze/github
//  Proxies GitHub URL analysis requests to the backend server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

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

    const backendRes = await fetch(`${BACKEND_URL}/api/analyze/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: body.url, sessionId: body.sessionId }),
    });

    if (!backendRes.ok) {
      const errorBody = await backendRes.text();
      return NextResponse.json(
        { error: 'Backend analysis failed', details: errorBody },
        { status: backendRes.status },
      );
    }

    const data = await backendRes.json();
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
