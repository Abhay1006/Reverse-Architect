// ============================================================
//  Atlas — Express application
//  Builds the app without listening, so tests can drive it
//  directly. server.ts owns the listener and process lifecycle.
// ============================================================

import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { apiRouter } from './api/routes.js';
import { aiRouter } from './ai/ai-router.js';
import { apiLimiter, MAX_UPLOAD_BYTES } from './api/middleware.js';
import { statusOf, toClientError } from './api/errors.js';

/** Raised by the CORS origin check; mapped to 403 by the error handler. */
class CorsRejectedError extends Error {
  constructor() {
    super('Origin not allowed by CORS policy');
    this.name = 'CorsRejectedError';
  }
}

export function createApp(): express.Express {
  const app = express();

  // Rate limiting keys on req.ip. Behind a reverse proxy or tunnel every request
  // otherwise looks like one client, making the per-IP quota a global one.
  // Set to the number of proxies in front of this server — never `true`, which
  // would let clients spoof X-Forwarded-For.
  const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // CORS: allow-list driven. The default is same-origin only, because this API
  // clones arbitrary repositories and serves file contents with no auth.
  // Set ALLOWED_ORIGINS=* to restore the previous open behaviour.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / server-side requests send no Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new CorsRejectedError());
      },
      credentials: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  // General API rate limiter
  app.use('/api/', apiLimiter);

  // Mount the API Routers
  app.use('/api', apiRouter);
  app.use('/api/ai', aiRouter);

  // Unknown API routes answer in JSON like everything else.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Final error handler. Without it, multer and CORS errors fell through to
  // Express's default handler: an HTML 500 page, with a stack trace whenever
  // NODE_ENV was not "production".
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let status: number;
    let message: string;

    if (err instanceof multer.MulterError) {
      status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      message = err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`
        : err.message;
    } else if (err instanceof CorsRejectedError) {
      status = 403;
      message = err.message;
    } else if (err instanceof SyntaxError && 'body' in err) {
      // express.json() could not parse the request body.
      status = 400;
      message = 'Request body is not valid JSON';
    } else if (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      // Client errors raised by Express middleware (e.g. body too large).
      status = err.status;
      message = toClientError(err);
    } else {
      status = statusOf(err);
      message = status >= 500 ? 'Internal server error' : toClientError(err);
      console.error(`[${req.method} ${req.originalUrl}] Unhandled error:`, err);
    }

    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json({ error: message });
  });

  return app;
}
