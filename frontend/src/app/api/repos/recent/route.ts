import { NextRequest } from 'next/server';
import { BACKEND_URL, backendUnreachable, clientHeaders, relayResponse } from '../../../lib/backend-proxy';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/repos/recent`, {
      cache: 'no-store',
      headers: clientHeaders(req),
    });
    return relayResponse(res.status, await res.text());
  } catch (err) {
    return backendUnreachable('/api/repos/recent', err);
  }
}
