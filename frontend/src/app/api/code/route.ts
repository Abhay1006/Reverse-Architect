import { NextResponse, NextRequest } from 'next/server';
import { BACKEND_URL, backendUnreachable, clientHeaders, relayResponse } from '../../lib/backend-proxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId');
  const filePath = searchParams.get('filePath');

  if (!repoId || !filePath) {
    return NextResponse.json({ error: 'Missing repoId or filePath' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/code?repoId=${encodeURIComponent(repoId)}&filePath=${encodeURIComponent(filePath)}`, {
      cache: 'no-store',
      headers: clientHeaders(req),
    });
    return relayResponse(res.status, await res.text());
  } catch (err) {
    return backendUnreachable('/api/code', err);
  }
}
