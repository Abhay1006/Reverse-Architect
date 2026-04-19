// ============================================================
//  Next.js API Route — POST /api/analyze/upload
//  Proxies multipart .zip uploads to the backend server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 },
      );
    }

    // Forward the raw body + content-type to the backend
    const backendRes = await fetch(`${BACKEND_URL}/api/analyze/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: request.body,
      // @ts-expect-error -- Node 18+ fetch supports duplex for streaming
      duplex: 'half',
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
    console.error('[/api/analyze/upload] Proxy error:', err);
    return NextResponse.json(
      {
        error: 'Failed to connect to analysis backend',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
