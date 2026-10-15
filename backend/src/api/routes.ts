import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { CacheManager } from '../cache/cache-manager.js';
import { getRemoteCommitSha } from '../cache/git.js';
import { touchWorkspace } from '../cache/reaper.js';
import { cloneRepo } from '../github/clone.js';
import { progressTracker, type ProgressEvent } from '../progress.js';
import { analyzeProjectDir } from './analyzer-pipeline.js';
import { analysisLimiter, codeLimiter, upload } from './middleware.js';
import { withRepoLock, activeAnalyses, queuedAnalyses } from './analysis-queue.js';
import { HttpError, statusOf, toClientError } from './errors.js';
import {
  ensureClonesBaseDir,
  isValidRepoId,
  newUploadId,
  normalizeRepoId,
  parseGithubRepoUrl,
  repoDir,
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

/** Upper bound on the total uncompressed size of an uploaded archive. */
const MAX_UNCOMPRESSED_BYTES = parseInt(process.env.ATLAS_UPLOAD_MAX_UNCOMPRESSED_BYTES ?? String(500 * 1024 * 1024), 10);

/** Upper bound on the number of entries in an uploaded archive. */
const MAX_ZIP_ENTRIES = parseInt(process.env.ATLAS_UPLOAD_MAX_ENTRIES ?? '20000', 10);

/**
 * Progress reporter for one request. A client that sends no sessionId gets no
 * progress events — they used to go to a shared 'default-session' channel, so
 * concurrent users saw each other's progress.
 */
function progressFor(sessionId: unknown): (event: ProgressEvent) => void {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 128
    ? sessionId
    : null;
  return (event) => {
    if (sid) progressTracker.emitProgress(sid, event);
  };
}

/** Drop a session's progress state shortly after the response has gone out. */
function scheduleProgressCleanup(sessionId: unknown): void {
  if (typeof sessionId === 'string' && sessionId) {
    setTimeout(() => progressTracker.cleanup(sessionId), 5000);
  }
}

/**
 * Extract a zip archive into `extractDir`, refusing archives that would
 * expand past the size or entry-count budget (zip bombs) and entries that
 * would escape the directory (Zip Slip).
 */
function extractZipSafely(zipPath: string, extractDir: string): void {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new HttpError(413, `Archive has too many entries (${entries.length}). The limit is ${MAX_ZIP_ENTRIES}.`);
  }

  // Check the declared sizes before writing anything. adm-zip refuses to
  // inflate an entry past its declared size, so this sum is a hard bound.
  const totalBytes = entries.reduce((sum, entry) => sum + (entry.isDirectory ? 0 : entry.header.size), 0);
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
    const mb = (n: number) => Math.round(n / (1024 * 1024));
    throw new HttpError(413, `Archive expands to ${mb(totalBytes)} MB, over the ${mb(MAX_UNCOMPRESSED_BYTES)} MB limit.`);
  }

  const extractDirResolved = path.resolve(extractDir);
  fs.mkdirSync(extractDirResolved, { recursive: true });

  for (const entry of entries) {
    let targetPath: string;
    try {
      targetPath = validateZipEntry(extractDirResolved, entry.entryName);
    } catch (err) {
      throw new HttpError(400, toClientError(err));
    }

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
  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    cleanup(file.path);
    res.status(400).json({ error: 'Only .zip files are accepted' });
    return;
  }

  const sessionId: unknown = req.body?.sessionId;
  const progress = progressFor(sessionId);
  const uploadId = newUploadId();
  const extractDir = path.join(ensureClonesBaseDir(), uploadId);

  try {
    // Extraction runs under the analysis lock too, so concurrent uploads are
    // bounded by the same limit as analyses rather than all expanding at once.
    const result = await withRepoLock(uploadId, async () => {
      progress({ step: 'extracting', message: 'Extracting archive...', progress: 10 });
      extractZipSafely(file.path, extractDir);

      // Find root and analyze
      const projectRoot = findProjectRoot(extractDir);
      progress({ step: 'starting-lsp', message: 'Analyzing project...', progress: 40 });
      return analyzeProjectDir(projectRoot);
    });

    progress({ step: 'done', message: 'Analysis complete!', progress: 100 });
    res.json({
      ...result,
      repoId: uploadId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/upload] Error:', err);
    const message = toClientError(err);
    cleanup(extractDir);
    progress({ step: 'error', message: `Analysis failed: ${message}` });
    res.status(statusOf(err)).json({ error: 'Analysis failed', details: message });
  } finally {
    // Cleanup temp uploaded file (keep the extracted directory for peeking)
    cleanup(file.path);
    scheduleProgressCleanup(sessionId);
  }
});

interface GithubRequestBody {
  url?: string;
  sessionId?: string;
}

/** POST /api/analyze/github — clone and analyze a GitHub repo */
apiRouter.post('/analyze/github', analysisLimiter, async (req: Request<Record<string, never>, unknown, GithubRequestBody>, res: Response): Promise<void> => {
  const { url, sessionId } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "url" field' });
    return;
  }

  // Strict validation for GitHub URLs to prevent SSRF or malformed repos.
  // The repo id is normalized (lowercase, no .git) so every spelling of the
  // same repository shares one clone and one cache entry.
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) {
    res.status(400).json({ error: 'URL must be a valid GitHub repository (e.g., https://github.com/user/repo)' });
    return;
  }
  const { repoId, cloneUrl } = parsed;
  const cloneDir = repoDir(repoId);
  const progress = progressFor(sessionId);

  try {
    // 1. Check cache freshness without cloning
    progress({ step: 'starting-lsp', message: `Checking cache for ${repoId}...` });
    console.log(`[Cache] Checking freshness for ${repoId}...`);
    const latestCommit = await getRemoteCommitSha(cloneUrl);

    /** The cached result, if it is for the commit the remote is on now. */
    const freshCachedResult = () => {
      if (!latestCommit || CacheManager.getLastCommit(repoId) !== latestCommit) return null;
      return CacheManager.getCachedResult(repoId);
    };

    // Fast path: fresh cache and the source files are still on disk.
    const cached = freshCachedResult();
    if (cached && fs.existsSync(cloneDir)) {
      console.log(`⚡ [Cache Hit] Returning cached analysis for ${repoId} (commit: ${latestCommit!.substring(0, 7)})`);
      touchWorkspace(cloneDir);
      progress({ step: 'done', message: 'Loaded from cache instantly!' });
      res.json({ ...cached, repoId });
      return;
    }

    if (!latestCommit) {
      console.log(`[Cache] Could not fetch remote commit for ${repoId}. Proceeding with analysis.`);
    }

    // 2. withRepoLock serializes against other analyses and collapses
    // concurrent requests for the same repo into one run, so two callers can't
    // clone into the same directory and delete each other's tree.
    const analysisResult = await withRepoLock(repoId, async () => {
      // Re-check inside the lock: another request may have finished meanwhile.
      const cachedInLock = freshCachedResult();

      progress({ step: 'cloning', message: cachedInLock ? `Restoring source files for ${repoId}...` : `Cloning repository ${repoId}...` });
      if (fs.existsSync(cloneDir)) {
        cleanup(cloneDir);
      }

      try {
        console.log(`Cloning ${cloneUrl} into ${cloneDir}...`);
        await cloneRepo(cloneUrl, cloneDir);

        // The analysis is cached but its clone was evicted: the files Code Peek
        // and the AI assistant read are back, and the graph is still valid.
        if (cachedInLock) return cachedInLock;

        progress({ step: 'extracting', message: `Running LSP analysis...`, progress: 50 });
        const result = await analyzeProjectDir(cloneDir);

        progress({ step: 'building-graph', message: `Building architecture graph...`, progress: 90 });

        // 3. Save to cache
        if (latestCommit) {
          console.log(`💾 [Cache] Saving result for ${repoId} (commit: ${latestCommit.substring(0, 7)})`);
          CacheManager.saveResult(repoId, cloneUrl, latestCommit, result);
        }
        return result;
      } catch (err) {
        cleanup(cloneDir);
        throw err;
      }
    });

    progress({ step: 'done', message: 'Analysis complete!', progress: 100 });
    res.json({
      ...analysisResult,
      repoId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/github] Error:', err);
    const message = toClientError(err);
    progress({ step: 'error', message: `Analysis failed: ${message}` });
    res.status(statusOf(err)).json({ error: 'Analysis failed', details: message });
  } finally {
    scheduleProgressCleanup(sessionId);
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
apiRouter.get('/code', codeLimiter, (req: Request<Record<string, never>, unknown, unknown, CodeRequestQuery>, res: Response): void => {
  const { filePath } = req.query;
  const rawRepoId = req.query.repoId;
  if (typeof rawRepoId !== 'string' || typeof filePath !== 'string' || !rawRepoId || !filePath) {
    res.status(400).json({ error: 'Missing repoId or filePath' });
    return;
  }

  const repoId = normalizeRepoId(rawRepoId);
  if (!isValidRepoId(repoId)) {
    res.status(400).json({ error: 'Invalid repoId' });
    return;
  }

  const repoPath = repoDir(repoId);
  // Browsing a repository keeps its workspace from being evicted.
  touchWorkspace(repoPath);

  // Resolve through symlinks and confirm containment. A cloned repo is
  // attacker-controlled content, so `link -> /etc/passwd` inside it must not
  // be readable through this endpoint.
  let fullFilePath = resolveWithinRoot(repoPath, filePath);

  if (!fullFilePath && fs.existsSync(repoPath)) {
    // Zip uploads may nest the project one directory deep — search for the
    // relative path, but re-validate every candidate against the repo root.
    // Candidates are real paths, so take them relative to the root's real
    // path: when the clones dir sits under a symlink (macOS /var → /private/var)
    // the lexical root would make every candidate look like it escaped.
    const realRepoPath = fs.realpathSync(repoPath);
    const findFileRecursively = (dir: string, relPath: string, depth: number): string | null => {
      if (depth > 8) return null;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          const candidate = resolveWithinRoot(subDir, relPath);
          if (candidate && resolveWithinRoot(repoPath, path.relative(realRepoPath, candidate))) {
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
  const rawRepoId = req.query.repoId;
  if (typeof rawRepoId !== 'string' || !rawRepoId) {
    return res.status(400).json({ error: 'Missing "repoId" query parameter' });
  }
  const repoId = normalizeRepoId(rawRepoId);
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
  if (typeof sessionId !== 'string' || !sessionId) {
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

  const onProgress = (event: ProgressEvent) => {
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
