import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { CacheManager } from '../cache/cache-manager.js';
import { getRemoteCommitSha } from '../cache/git.js';
import { progressTracker } from '../progress.js';
import { analyzeProjectDir } from './analyzer-pipeline.js';
import { analysisLimiter, upload } from './middleware.js';

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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  const uploadId = `upload-${Date.now()}`;
  const clonesBaseDir = path.join(os.homedir(), '.atlas', 'clones');
  const extractDir = path.join(clonesBaseDir, uploadId);
  
  if (!fs.existsSync(clonesBaseDir)) {
    fs.mkdirSync(clonesBaseDir, { recursive: true });
  }

  try {
    // Extract the zip safely (protecting against Zip Slip vulnerabilities)
    const zip = new AdmZip(file.path);
    const extractDirResolved = path.resolve(extractDir);

    for (const entry of zip.getEntries()) {
      const targetPath = path.resolve(extractDirResolved, entry.entryName);
      const relative = path.relative(extractDirResolved, targetPath);

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Directory traversal attempt detected in zip file: ${entry.entryName}`);
      }

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, entry.getData());
      }
    }

    // Find root and analyze
    const projectRoot = findProjectRoot(extractDir);
    const result = await analyzeProjectDir(projectRoot);

    res.json({
      ...result,
      repoId: uploadId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/upload] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Analysis failed', details: message });
  } finally {
    // Cleanup temp uploaded file (keep the extracted directory for peeking)
    cleanup(file.path);
  }
});

interface GithubRequestBody {
  url?: string;
  sessionId?: string;
}

/** POST /api/analyze/github — clone and analyze a GitHub repo */
apiRouter.post('/analyze/github', analysisLimiter, async (req: Request<{}, {}, GithubRequestBody>, res: Response): Promise<void> => {
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

    // 2. Perform full analysis
    progressTracker.emitProgress(sid, { step: 'cloning', message: `Cloning repository ${repoId}...` });
    
    const clonesBaseDir = path.join(os.homedir(), '.atlas', 'clones');
    const cloneDir = path.join(clonesBaseDir, repoId);
    
    if (!fs.existsSync(clonesBaseDir)) {
      fs.mkdirSync(clonesBaseDir, { recursive: true });
    }
    
    if (fs.existsSync(cloneDir)) {
      cleanup(cloneDir);
    }

    let analysisResult;
    try {
      console.log(`Cloning ${cleanUrl} into ${cloneDir}...`);
      const { cloneRepo } = await import('../github/clone.js');
      await cloneRepo(cleanUrl, cloneDir);

      progressTracker.emitProgress(sid, { step: 'extracting', message: `Running LSP analysis...`, progress: 50 });
      analysisResult = await analyzeProjectDir(cloneDir);
      
      progressTracker.emitProgress(sid, { step: 'building-graph', message: `Building architecture graph...`, progress: 90 });
      
      // 3. Save to cache
      if (latestCommit) {
        console.log(`💾 [Cache] Saving result for ${repoId} (commit: ${latestCommit.substring(0, 7)})`);
        CacheManager.saveResult(repoId, cleanUrl, latestCommit, analysisResult);
      }
    } catch (err) {
      cleanup(cloneDir);
      throw err;
    }

    progressTracker.emitProgress(sid, { step: 'done', message: 'Analysis complete!', progress: 100 });
    res.json({
      ...analysisResult,
      repoId,
    });
  } catch (err: unknown) {
    console.error('[/api/analyze/github] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
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
apiRouter.get('/code', (req: Request<{}, {}, {}, CodeRequestQuery>, res: Response): void => {
  const { repoId, filePath } = req.query;
  if (!repoId || !filePath) {
    res.status(400).json({ error: 'Missing repoId or filePath' });
    return;
  }

  // Prevent directory traversal attacks
  const safeRepoId = path.normalize(repoId).replace(/^(\.\.(\/|\\|$))+/, '');
  const safeFilePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');

  const clonesBaseDir = path.join(os.homedir(), '.atlas', 'clones');
  const repoPath = path.join(clonesBaseDir, safeRepoId);
  
  let fullFilePath = path.join(repoPath, safeFilePath);
  
  if (!fs.existsSync(fullFilePath)) {
    // If it's a zip upload with nested directories, search for the relative path
    const findFileRecursively = (dir: string, relPath: string): string | null => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subDir = path.join(dir, entry.name);
            const candidate = path.join(subDir, relPath);
            if (fs.existsSync(candidate)) {
              return candidate;
            }
            const nested = findFileRecursively(subDir, relPath);
            if (nested) return nested;
          }
        }
      } catch {
        // ignore read errors
      }
      return null;
    };
    
    if (fs.existsSync(repoPath)) {
      const nestedPath = findFileRecursively(repoPath, safeFilePath);
      if (nestedPath) {
        fullFilePath = nestedPath;
      }
    }
  }

  if (!fullFilePath.startsWith(repoPath)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (!fs.existsSync(fullFilePath) || fs.statSync(fullFilePath).isDirectory()) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  try {
    const code = fs.readFileSync(fullFilePath, 'utf8');
    const ext = path.extname(fullFilePath).toLowerCase().substring(1);
    res.json({ code, language: ext });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file', details: String(err) });
  }
});

interface CachedQuery {
  repoId?: string;
}

/** GET /api/analyze/github/cached — return analysis ONLY if cached */
apiRouter.get('/analyze/github/cached', (req: Request<{}, {}, {}, CachedQuery>, res: Response) => {
  const repoId = req.query.repoId;
  if (!repoId) {
    return res.status(400).json({ error: 'Missing "repoId" query parameter' });
  }
  
  try {
    const cachedResult = CacheManager.getCachedResult(repoId);
    if (cachedResult) {
      return res.json(cachedResult);
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
apiRouter.get('/analyze/progress', (req: Request<{}, {}, {}, ProgressQuery>, res: Response) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
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

  progressTracker.on(`progress:${sessionId}`, onProgress);

  req.on('close', () => {
    progressTracker.off(`progress:${sessionId}`, onProgress);
  });
});
