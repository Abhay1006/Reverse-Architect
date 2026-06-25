// ============================================================
//  Atlas-TS — Backend Express API Server
//  Exposes endpoints for analyzing TypeScript/JavaScript projects
//  via file upload (.zip) or GitHub URL.
//  🔄 Now powered by LSP (Language Server Protocol)
// ============================================================

import express from 'express';
import cors from 'cors';
import { apiRouter } from './api/routes.js';
import { apiLimiter } from './api/middleware.js';

// Load optional .env file if present
try {
  process.loadEnvFile();
} catch {
  // Fallback to default/existing environment variables
}

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const app = express();

app.use(cors());
app.use(express.json());

// General API rate limiter
app.use('/api/', apiLimiter);

// Mount the API Router
app.use('/api', apiRouter);

const server = app.listen(PORT, () => {
  console.log(`\n🏛️  Atlas-TS backend running on http://localhost:${PORT}`);
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

