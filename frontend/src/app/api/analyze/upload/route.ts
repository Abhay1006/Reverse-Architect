// ============================================================
//  Next.js API Route — POST /api/analyze/upload
//  Proxies multipart .zip uploads to the backend server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, backendUnreachable, clientHeaders, relayResponse } from '../../../lib/backend-proxy';

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
        ...clientHeaders(request),
        'Content-Type': contentType,
      },
      body: request.body,
      // @ts-expect-error -- Node 18+ fetch supports duplex for streaming
      duplex: 'half',
    });

    return relayResponse(backendRes.status, await backendRes.text());
  } catch (err) {
    return backendUnreachable('/api/analyze/upload', err);
  }
}
