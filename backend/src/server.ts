// ============================================================
//  Atlas — Backend API Server
//  Exposes endpoints for analyzing projects via file upload
//  (.zip) or GitHub URL, powered by the Language Server Protocol.
// ============================================================

// Load optional .env file if present. This must run before any module that
// reads configuration at import time (cache, path-safety, AI providers), so
// the app is imported dynamically below.
try {
  process.loadEnvFile();
} catch {
  // Fallback to default/existing environment variables
}

const { createApp } = await import('./app.js');
const { startCloneReaper } = await import('./cache/reaper.js');
const { CacheManager } = await import('./cache/cache-manager.js');
const { shutdownAllLspServers } = await import('./lsp/index.js');

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

const app = createApp();

// Evict stale clone/upload workspaces so disk usage stays bounded.
const reaper = startCloneReaper();

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🏛️  Atlas backend running on http://${HOST}:${PORT}`);
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

// ── Graceful shutdown ───────────────────────────────────────────────────────
// pm2 restarts and deploys send SIGTERM. Without this, running
// typescript-language-server children were orphaned and SQLite was never
// closed cleanly.

/** Hard deadline for shutdown before the process exits anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[Shutdown] ${signal} received — closing server...`);

  const forceExit = setTimeout(() => {
    console.error('[Shutdown] Timed out — forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  clearInterval(reaper);
  // Stop accepting connections; drop idle keep-alive sockets right away.
  server.close();
  server.closeIdleConnections();

  await shutdownAllLspServers();
  // Long-lived responses (SSE progress, AI streams) would hold close() open.
  server.closeAllConnections();

  try {
    CacheManager.close();
  } catch (err) {
    console.error('[Shutdown] Failed to close the cache database:', err);
  }

  console.log('[Shutdown] Done.');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
