import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, clientHeaders } from '../../../lib/backend-proxy';

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
  const url = new URL(req.url);
  const targetPath = url.pathname; // e.g. /api/ai/chat or /api/ai/issues
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  const headers = new Headers(clientHeaders(req));
  req.headers.forEach((value, key) => {
    // Forward relevant headers, especially our custom key/provider headers
    if (key.startsWith('x-ai-') || key === 'content-type' || key === 'user-agent') {
      headers.set(key, value);
    }
  });

  try {
    // `duplex` is required by undici when the body is a stream, but is not yet
    // part of the DOM RequestInit type.
    const fetchOptions: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers,
    };

    if (req.method === 'POST') {
      fetchOptions.body = req.body;
      fetchOptions.duplex = 'half';
    }

    const res = await fetch(targetUrl, fetchOptions);

    // If it's a Server-Sent Event stream, return the readable stream directly!
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Otherwise, return standard body
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
      },
    });

  } catch (err) {
    console.error(`Error in Next.js AI proxy:`, err);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  }
}
