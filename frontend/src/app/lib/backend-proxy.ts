// ============================================================
//  Atlas — Shared helpers for the Next.js → backend proxy routes
//  Server-only: imported by app/api/**/route.ts, never by the browser.
// ============================================================

import { NextResponse } from 'next/server';

/**
 * Where the proxy routes reach the backend. Every route reads this one value —
 * they used to read two different variables, so setting the documented
 * BACKEND_URL alone broke the AI, Code Peek, progress and recent-repo routes.
 * NEXT_PUBLIC_BACKEND_URL is still honoured as a fallback for older .env files.
 */
export const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

/**
 * Headers that identify the original client to the backend.
 *
 * Every proxied request reaches the backend from this server's address, so
 * without X-Forwarded-For its per-IP rate limits apply to all users at once.
 * The backend only trusts this header when TRUST_PROXY_HOPS is set.
 */
export function clientHeaders(req: Request): Record<string, string> {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};
}

/**
 * Relay a backend response body and status to the browser unchanged.
 *
 * The backend answers errors with `{ error, details }`, where `details` is the
 * useful part ("Repository is too large to analyze..."). Wrapping that body in
 * a new `{ error: 'Backend analysis failed' }` hid it from users.
 */
export function relayResponse(status: number, bodyText: string): NextResponse {
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { error: bodyText.trim() || `Backend returned ${status}` };
  }
  return NextResponse.json(body, { status });
}

/** The 502 a route returns when the backend cannot be reached at all. */
export function backendUnreachable(route: string, err: unknown): NextResponse {
  console.error(`[${route}] Proxy error:`, err);
  return NextResponse.json(
    {
      error: 'Failed to connect to analysis backend',
      details: err instanceof Error ? err.message : String(err),
    },
    { status: 502 },
  );
}
