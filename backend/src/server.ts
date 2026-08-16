// ============================================================
//  Atlas-TS — Backend Express API Server
//  Exposes endpoints for analyzing TypeScript/JavaScript projects
//  via file upload (.zip) or GitHub URL.
//  🔄 Now powered by LSP (Language Server Protocol)
// ============================================================

import express from 'express';
import cors from 'cors';
import { apiRouter } from './api/routes.js';
import { aiRouter } from './ai/ai-router.js';
import { apiLimiter } from './api/middleware.js';
import { startCloneReaper } from './cache/reaper.js';

// Load optional .env file if present
try {
  process.loadEnvFile();
} catch {
  // Fallback to default/existing environment variables
}

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const HOST = process.env.HOST ?? '127.0.0.1';
const app = express();

// Rate limiting keys on req.ip. Behind a reverse proxy or tunnel every request
// otherwise looks like one client, making the per-IP quota a global one.
// Set to the number of proxies in front of this server — never `true`, which
// would let clients spoof X-Forwarded-For.
const TRUST_PROXY_HOPS = parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10);
if (TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', TRUST_PROXY_HOPS);
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
      return callback(new Error('Origin not allowed by CORS policy'));
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

// Evict stale clone/upload workspaces so disk usage stays bounded.
startCloneReaper();

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🏛️  Atlas-TS backend running on http://${HOST}:${PORT}`);
  console.log(`   Engine: LSP (Language Server Protocol)`);
  console.log(`   POST /api/analyze/upload   — Upload .zip`);
  console.log(`   POST /api/analyze/github   — Analyze GitHub repo`);
  console.log(`   GET  /api/health           — Health check\n`);
});

// Configure timeouts (10 minutes) to allow cloning & analyzing large codebases
server.headersTimeout = 10 * 60 * 1000;
server.requestTimeout = 10 * 60 * 1000;
server.timeout = 10 * 60 * 1000;
server.keepAliveTimeout = 9 * 60 * 1000; // should be slightly less than headersTimeout
