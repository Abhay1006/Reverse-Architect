import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { CacheManager } from '../cache/cache-manager.js';
import { getRemoteCommitSha } from '../cache/git.js';
import { progressTracker } from '../progress.js';
import { analyzeProjectDir } from './analyzer-pipeline.js';
import { analysisLimiter, upload } from './middleware.js';
import { withRepoLock, activeAnalyses, queuedAnalyses } from './analysis-queue.js';
import { toClientError } from './errors.js';
import {
  CLONES_BASE_DIR,
  ensureClonesBaseDir,
  isValidRepoId,
  resolveWithinRoot,
  validateZipEntry,
  assertRealDirWithin,
} from './path-safety.js';

export const apiRouter = Router();

/** Safely remove a directory tree (best effort). */
function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/**
 * After extracting a .zip, the actual project root might be nested
 * one directory deep (e.g., repo-name/src/). This finds the best root.
 */
function findProjectRoot(extractedDir: string): string {
  const entries = fs.readdirSync(extractedDir);
  if (entries.length === 1) {
    const child = path.join(extractedDir, entries[0]!);
    if (fs.statSync(child).isDirectory()) {
      return child;
    }
  }
  return extractedDir;
}

/** Health check */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    analyses: { active: activeAnalyses(), queued: queuedAnalyses() },
  });
});

/** POST /api/analyze/upload — accept a .zip file */
apiRouter.post('/analyze/upload', analysisLimiter, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Ensure it looks like a zip
  if (!file.originalname.endsWith('.zip')) {
    cleanup(file.path);
    res.status(400).json({ error: 'Only .zip files are accepted' });
    return;
  }

  const sid = typeof req.body?.sessionId === 'string' && req.body.sessionId
    ? req.body.sessionId
    : 'default-session';

  const uploadId = `upload-${Date.now()}`;
  const extractDir = path.join(ensureClonesBaseDir(), uploadId);

  try {
    progressTracker.emitProgress(sid, { step: 'extracting', message: 'Extracting archive...', progress: 10 });

    // Extract the zip safely (protecting against Zip Slip vulnerabilities)
    const zip = new AdmZip(file.path);
    const extractDirResolved = path.resolve(extractDir);

    for (const entry of zip.getEntries()) {
      const targetPath = validateZipEntry(extractDirResolved, entry.entryName);

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
        assertRealDirWithin(extractDirResolved, targetPath);
      } else {
        const parent = path.dirname(targetPath);
        fs.mkdirSync(parent, { recursive: true });
        // An earlier entry may have created `parent` as a symlink pointing
        // outside the extraction directory — verify before writing into it.
        assertRealDirWithin(extractDirResolved, parent);
        fs.writeFileSync(targetPath, entry.getData());
      }
    }

    // Find root and analyze (serialized against other analyses)
    const projectRoot = findProjectRoot(extractDir);
    progressTracker.emitProgress(sid, { step: 'starting-lsp', message: 'Analyzing project...', progress: 40 });

    const result = await withRepoLock(uploadId, () => analyzeProjectDir(projectRoot));

    progressTracker.emitProgress(sid, { step: 'done', message: 'Analysis complete!', progress: 100 });
    res.json({
      ...result,
      repoId: uploadId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/upload] Error:', err);
    const message = toClientError(err);
    cleanup(extractDir);
    progressTracker.emitProgress(sid, { step: 'error', message: `Analysis failed: ${message}` });
    res.status(500).json({ error: 'Analysis failed', details: message });
  } finally {
    // Cleanup temp uploaded file (keep the extracted directory for peeking)
    cleanup(file.path);
    setTimeout(() => progressTracker.cleanup(sid), 5000);
  }
});

interface GithubRequestBody {
  url?: string;
  sessionId?: string;
}

/** POST /api/analyze/github — clone and analyze a GitHub repo */
apiRouter.post('/analyze/github', analysisLimiter, async (req: Request<Record<string, never>, unknown, GithubRequestBody>, res: Response): Promise<void> => {
  const { url, sessionId } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "url" field' });
    return;
  }

  const sid = sessionId || 'default-session';

  // Strict validation for GitHub URLs to prevent SSRF or malformed repos
  const githubUrlRegex = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;
  if (!githubUrlRegex.test(url.trim())) {
    res.status(400).json({ error: 'URL must be a valid GitHub repository (e.g., https://github.com/user/repo)' });
    return;
  }

  const cleanUrl = url.trim();
  const repoId = cleanUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');

  if (!isValidRepoId(repoId)) {
    res.status(400).json({ error: 'URL must be a valid GitHub repository (e.g., https://github.com/user/repo)' });
    return;
  }

  try {
    // 1. Check cache freshness without cloning
    progressTracker.emitProgress(sid, { step: 'starting-lsp', message: `Checking cache for ${repoId}...` });
    console.log(`[Cache] Checking freshness for ${repoId}...`);
    const latestCommit = getRemoteCommitSha(cleanUrl);

    if (latestCommit) {
      const cachedCommit = CacheManager.getLastCommit(repoId);
      if (cachedCommit === latestCommit) {
        const cachedResult = CacheManager.getCachedResult(repoId);
        if (cachedResult) {
          console.log(`⚡ [Cache Hit] Returning cached analysis for ${repoId} (commit: ${latestCommit.substring(0, 7)})`);
          progressTracker.emitProgress(sid, { step: 'done', message: 'Loaded from cache instantly!' });
          progressTracker.cleanup(sid);
          res.json({
            ...cachedResult,
            repoId,
          });
          return;
        }
      } else {
        console.log(`🔄 [Cache Miss/Stale] Cache commit: ${cachedCommit || 'none'}, Remote commit: ${latestCommit}`);
      }
    } else {
      console.log(`[Cache] Could not fetch remote commit for ${repoId}. Proceeding with analysis.`);
    }

    // 2. Perform full analysis. withRepoLock serializes against other analyses
    // and collapses concurrent requests for the same repo into one run, so two
    // callers can't clone into the same directory and delete each other's tree.
    const cloneDir = path.join(ensureClonesBaseDir(), repoId);

    const analysisResult = await withRepoLock(repoId, async () => {
      progressTracker.emitProgress(sid, { step: 'cloning', message: `Cloning repository ${repoId}...` });

      if (fs.existsSync(cloneDir)) {
        cleanup(cloneDir);
      }

      try {
        console.log(`Cloning ${cleanUrl} into ${cloneDir}...`);
        const { cloneRepo } = await import('../github/clone.js');
        await cloneRepo(cleanUrl, cloneDir);

        progressTracker.emitProgress(sid, { step: 'extracting', message: `Running LSP analysis...`, progress: 50 });
        const result = await analyzeProjectDir(cloneDir);

        progressTracker.emitProgress(sid, { step: 'building-graph', message: `Building architecture graph...`, progress: 90 });

        // 3. Save to cache
        if (latestCommit) {
          console.log(`💾 [Cache] Saving result for ${repoId} (commit: ${latestCommit.substring(0, 7)})`);
          CacheManager.saveResult(repoId, cleanUrl, latestCommit, result);
        }
        return result;
      } catch (err) {
        cleanup(cloneDir);
        throw err;
      }
    });

    progressTracker.emitProgress(sid, { step: 'done', message: 'Analysis complete!', progress: 100 });
    res.json({
      ...analysisResult,
      repoId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/github] Error:', err);
    const message = toClientError(err);
    progressTracker.emitProgress(sid, { step: 'error', message: `Analysis failed: ${message}` });
    res.status(500).json({ error: 'Analysis failed', details: message });
  } finally {
    setTimeout(() => progressTracker.cleanup(sid), 5000);
  }
});

/** GET /api/repos/recent — get list of recently analyzed repos */
apiRouter.get('/repos/recent', (_req: Request, res: Response) => {
  try {
    const recent = CacheManager.getRecentRepos(6);
    res.json({ repos: recent });
  } catch (err) {
    console.error('[/api/repos/recent] Error:', err);
    res.status(500).json({ error: 'Failed to fetch recent repos' });
  }
});

interface CodeRequestQuery {
  repoId?: string;
  filePath?: string;
}

/** GET /api/code — read file code for peeking */
apiRouter.get('/code', (req: Request<Record<string, never>, unknown, unknown, CodeRequestQuery>, res: Response): void => {
  const { repoId, filePath } = req.query;
  if (!repoId || !filePath) {
    res.status(400).json({ error: 'Missing repoId or filePath' });
    return;
  }

  if (!isValidRepoId(repoId)) {
    res.status(400).json({ error: 'Invalid repoId' });
    return;
  }

  const repoPath = path.join(CLONES_BASE_DIR, repoId);

  // Resolve through symlinks and confirm containment. A cloned repo is
  // attacker-controlled content, so `link -> /etc/passwd` inside it must not
  // be readable through this endpoint.
  let fullFilePath = resolveWithinRoot(repoPath, filePath);

  if (!fullFilePath && fs.existsSync(repoPath)) {
    // Zip uploads may nest the project one directory deep — search for the
    // relative path, but re-validate every candidate against the repo root.
    const findFileRecursively = (dir: string, relPath: string, depth: number): string | null => {
      if (depth > 8) return null;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          const candidate = resolveWithinRoot(subDir, relPath);
          if (candidate && resolveWithinRoot(repoPath, path.relative(repoPath, candidate))) {
            return candidate;
          }
          const nested = findFileRecursively(subDir, relPath, depth + 1);
          if (nested) return nested;
        }
      } catch {
        // ignore read errors
      }
      return null;
    };

    fullFilePath = findFileRecursively(repoPath, filePath, 0);
  }

  if (!fullFilePath) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(fullFilePath);
  } catch {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  if (!stats.isFile()) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Code Peek renders source in a drawer — refuse to stream large binaries.
  const MAX_PEEK_BYTES = 2 * 1024 * 1024;
  if (stats.size > MAX_PEEK_BYTES) {
    res.status(413).json({ error: 'File is too large to preview' });
    return;
  }

  try {
    const code = fs.readFileSync(fullFilePath, 'utf8');
    const ext = path.extname(fullFilePath).toLowerCase().substring(1);
    res.json({ code, language: ext });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file', details: toClientError(err) });
  }
});

interface CachedQuery {
  repoId?: string;
}

/** GET /api/analyze/github/cached — return analysis ONLY if cached */
apiRouter.get('/analyze/github/cached', (req: Request<Record<string, never>, unknown, unknown, CachedQuery>, res: Response) => {
  const repoId = req.query.repoId;
  if (!repoId) {
    return res.status(400).json({ error: 'Missing "repoId" query parameter' });
  }
  if (!isValidRepoId(repoId)) {
    return res.status(400).json({ error: 'Invalid repoId' });
  }

  try {
    const cachedResult = CacheManager.getCachedResult(repoId);
    if (cachedResult) {
      return res.json({ ...cachedResult, repoId });
    } else {
      return res.status(404).json({ error: 'Not found in cache' });
    }
  } catch (err) {
    console.error('[/api/analyze/github/cached] Error:', err);
    return res.status(500).json({ error: 'Failed to query cache' });
  }
});

interface ProgressQuery {
  sessionId?: string;
}

/** GET /api/analyze/progress — Server-Sent Events stream for analysis progress */
apiRouter.get('/analyze/progress', (req: Request<Record<string, never>, unknown, unknown, ProgressQuery>, res: Response) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  if (sessionId.length > 128) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial state if any
  const lastEvent = progressTracker.getLastEvent(sessionId);
  if (lastEvent) {
    res.write(`data: ${JSON.stringify(lastEvent)}\n\n`);
  }

  const onProgress = (event: { step: string; message: string; progress?: number }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.step === 'done' || event.step === 'error') {
      res.end();
    }
  };

  progressTracker.subscribe(sessionId, onProgress);

  req.on('close', () => {
    progressTracker.unsubscribe(sessionId, onProgress);
  });
});
