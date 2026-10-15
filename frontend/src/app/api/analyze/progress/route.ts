import { NextResponse } from 'next/server';
import { BACKEND_URL, backendUnreachable, clientHeaders, relayResponse } from '../../../lib/backend-proxy';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze/progress?sessionId=${encodeURIComponent(sessionId)}`, {
      cache: 'no-store',
      headers: clientHeaders(req),
    });

    if (!res.ok) {
      return relayResponse(res.status, await res.text());
    }

    // Proxy the Server-Sent Events stream
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return backendUnreachable('/api/analyze/progress', err);
  }
}
