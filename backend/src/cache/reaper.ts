// ============================================================
//  Atlas — Clone Directory Reaper
//  Cloned repos and extracted uploads are kept after analysis so
//  Code Peek can read source files. Nothing used to delete them,
//  so disk usage grew without bound. This evicts by age, then by
//  total size (oldest first).
// ============================================================

import fs from 'fs';
import path from 'path';
import { CLONES_BASE_DIR } from '../api/path-safety.js';
import { isInFlight } from '../api/analysis-queue.js';

/** Delete workspaces untouched for longer than this. Default: 24h. */
const MAX_AGE_MS = parseInt(process.env.ATLAS_CLONE_MAX_AGE_MS ?? String(24 * 60 * 60 * 1000), 10);

/** Total budget for all workspaces combined. Default: 2 GiB. */
const MAX_TOTAL_BYTES = parseInt(process.env.ATLAS_CLONE_MAX_BYTES ?? String(2 * 1024 * 1024 * 1024), 10);

/** How often the sweep runs. Default: 1h. */
const SWEEP_INTERVAL_MS = parseInt(process.env.ATLAS_CLONE_SWEEP_MS ?? String(60 * 60 * 1000), 10);

interface Workspace {
  dir: string;
  /** Repo id / upload id — the key the analysis lock uses. */
  key: string;
  mtimeMs: number;
  bytes: number;
}

/** Recursive size of a directory, ignoring anything unreadable. */
function dirSize(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
      // Symlinks are deliberately not followed.
    } catch {
      // Vanished mid-walk — ignore.
    }
  }
  return total;
}

/**
 * Enumerate workspace directories. GitHub clones live one level deeper
 * (`owner/repo`), uploads sit directly under the base directory.
 */
function listWorkspaces(): Workspace[] {
  const found: Workspace[] = [];
  let owners: fs.Dirent[];
  try {
    owners = fs.readdirSync(CLONES_BASE_DIR, { withFileTypes: true });
  } catch {
    return found;
  }

  const record = (dir: string) => {
    try {
      const key = path.relative(CLONES_BASE_DIR, dir).split(path.sep).join('/');
      found.push({ dir, key, mtimeMs: fs.statSync(dir).mtimeMs, bytes: dirSize(dir) });
    } catch {
      // Ignore.
    }
  };

  for (const owner of owners) {
    if (!owner.isDirectory()) continue;
    const ownerPath = path.join(CLONES_BASE_DIR, owner.name);

    if (owner.name.startsWith('upload-')) {
      record(ownerPath);
      continue;
    }

    let repos: fs.Dirent[];
    try {
      repos = fs.readdirSync(ownerPath, { withFileTypes: true });
    } catch {
      continue;
    }

    if (repos.length === 0) {
      record(ownerPath);
      continue;
    }
    for (const repo of repos) {
      if (repo.isDirectory()) record(path.join(ownerPath, repo.name));
    }
  }

  return found;
}

function remove(dir: string, reason: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[Reaper] Evicted ${dir} (${reason})`);
  } catch (err) {
    console.warn(`[Reaper] Failed to evict ${dir}:`, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Run one eviction pass: first anything older than MAX_AGE_MS, then the
 * oldest remaining workspaces until the total fits within MAX_TOTAL_BYTES.
 */
function sweepClones(): void {
  const now = Date.now();
  // A workspace being cloned or analyzed right now is never a candidate, no
  // matter how old its directory looks or how far over budget we are.
  let workspaces = listWorkspaces().filter((ws) => !isInFlight(ws.key));

  // Pass 1 — age.
  const survivors: Workspace[] = [];
  for (const ws of workspaces) {
    if (now - ws.mtimeMs > MAX_AGE_MS) {
      remove(ws.dir, `older than ${Math.round(MAX_AGE_MS / 3_600_000)}h`);
    } else {
      survivors.push(ws);
    }
  }
  workspaces = survivors;

  // Pass 2 — total size budget, oldest first.
  let total = workspaces.reduce((sum, ws) => sum + ws.bytes, 0);
  if (total <= MAX_TOTAL_BYTES) return;

  workspaces.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const ws of workspaces) {
    if (total <= MAX_TOTAL_BYTES) break;
    remove(ws.dir, 'total size budget exceeded');
    total -= ws.bytes;
  }
}

/**
 * Mark a workspace as recently used. Eviction is by directory mtime, which
 * reading files does not change, so a repository served from cache or browsed
 * through Code Peek would otherwise be evicted 24h after it was cloned.
 */
export function touchWorkspace(dir: string): void {
  try {
    const now = new Date();
    fs.utimesSync(dir, now, now);
  } catch {
    // Missing directory — nothing to keep alive.
  }
}

/** Start the periodic sweep. Runs once immediately, then on an interval. */
export function startCloneReaper(): NodeJS.Timeout {
  try {
    sweepClones();
  } catch (err) {
    console.warn('[Reaper] Initial sweep failed:', err);
  }

  const timer = setInterval(() => {
    try {
      sweepClones();
    } catch (err) {
      console.warn('[Reaper] Sweep failed:', err);
    }
  }, SWEEP_INTERVAL_MS);

  // Never hold the process open just for the reaper.
  timer.unref();
  return timer;
}
