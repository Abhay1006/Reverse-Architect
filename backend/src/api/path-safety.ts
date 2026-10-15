// ============================================================
//  Atlas — Path Safety
//  Every filesystem path that originates from user input (repo ids,
//  file paths, zip entry names) must pass through here.
//
//  This module is imported by the route handlers AND by the tests, so a
//  regression in containment logic fails the suite. Do not inline copies
//  of these checks anywhere else.
// ============================================================

import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';

/** Root directory holding every cloned/extracted repository. */
export const CLONES_BASE_DIR = path.resolve(
  process.env.ATLAS_CLONES_DIR || path.join(os.homedir(), '.atlas', 'clones'),
);

/** A GitHub repo id: exactly `owner/repo`, no path separators beyond one. */
const GITHUB_REPO_ID_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * A zip-upload id, as minted by the upload route: `upload-<uuid v4>`.
 * Ids used to be `upload-<Date.now()>`, which anyone could enumerate to read
 * other people's uploaded source through /api/code.
 */
const UPLOAD_ID_RE = /^upload-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Mint a new, unguessable upload id. */
export function newUploadId(): string {
  return `upload-${randomUUID()}`;
}

/** True if `id` names a zip upload rather than a GitHub repository. */
export function isUploadId(id: string): boolean {
  return UPLOAD_ID_RE.test(id);
}

/**
 * Canonical form of a GitHub repo id. GitHub treats owner and repo names
 * case-insensitively and accepts an optional `.git` suffix, so `User/Repo`,
 * `user/repo` and `user/repo.git` must all share one clone and one cache row.
 * Upload ids are returned unchanged.
 */
export function normalizeRepoId(id: string): string {
  if (isUploadId(id)) return id;
  return id.trim().replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

/** Strict shape of a GitHub repository URL accepted by the analyze endpoint. */
const GITHUB_URL_RE = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

/**
 * Parse a GitHub repository URL into its canonical repo id and clone URL.
 * Returns null for anything that is not exactly `https://github.com/owner/repo`.
 */
export function parseGithubRepoUrl(url: string): { repoId: string; cloneUrl: string } | null {
  const match = GITHUB_URL_RE.exec(url.trim());
  if (!match) return null;
  const repoId = normalizeRepoId(`${match[1]}/${match[2]}`);
  if (!isValidRepoId(repoId) || isUploadId(repoId)) return null;
  return { repoId, cloneUrl: `https://github.com/${repoId}` };
}

/**
 * True if `id` is a repository identifier we are willing to turn into a path.
 *
 * Rejects traversal (`../`), absolute paths, and anything with extra segments.
 * `.` and `..` are excluded explicitly because `[\w.-]+` would otherwise match
 * them (e.g. `../..`).
 */
export function isValidRepoId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0 || id.length > 256) return false;
  if (!GITHUB_REPO_ID_RE.test(id) && !UPLOAD_ID_RE.test(id)) return false;
  // Guard against segments that are purely dots: `../..`, `./x`, `a/..`
  return id.split('/').every((segment) => segment !== '.' && segment !== '..' && segment.length > 0);
}

/**
 * True if `target` is `root` itself or lives underneath it.
 * Uses path.relative rather than startsWith, so `/a/repo-evil` is not
 * considered to be inside `/a/repo`.
 */
export function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  if (rel === '') return true;
  return !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel);
}

/**
 * Normalize a user-supplied relative path and strip any leading traversal.
 * The result is still untrusted — always feed it to resolveWithinRoot.
 */
export function sanitizeRelativePath(input: string): string {
  return path.normalize(input).replace(/^(\.\.(\/|\\|$))+/, '');
}

/**
 * Resolve `relativePath` inside `rootDir`, following symlinks, and return the
 * real path only if it is genuinely contained by the real `rootDir`.
 *
 * Symlink resolution matters because a cloned repository is attacker-controlled
 * content: a repo can contain `link -> /home/user/.ssh/id_rsa`, which a purely
 * lexical check would happily accept.
 *
 * @returns the resolved real path, or null if missing or out of bounds.
 */
export function resolveWithinRoot(rootDir: string, relativePath: string): string | null {
  const candidate = path.resolve(rootDir, sanitizeRelativePath(relativePath));

  // Cheap lexical check first.
  if (!isInside(path.resolve(rootDir), candidate)) return null;

  let realRoot: string;
  let realTarget: string;
  try {
    realRoot = fs.realpathSync(rootDir);
    realTarget = fs.realpathSync(candidate);
  } catch {
    // Missing path, or a broken symlink — treat as not found.
    return null;
  }

  return isInside(realRoot, realTarget) ? realTarget : null;
}

/**
 * Validate a single zip entry name against the extraction directory.
 *
 * @returns the absolute path the entry may be written to.
 * @throws if the entry would escape the extraction directory (Zip Slip).
 */
export function validateZipEntry(extractDirResolved: string, entryName: string): string {
  const targetPath = path.resolve(extractDirResolved, entryName);

  if (!isInside(extractDirResolved, targetPath)) {
    throw new Error(`Directory traversal attempt detected in zip file: ${entryName}`);
  }
  return targetPath;
}

/**
 * Verify that the directory a zip entry is about to be written into has not
 * been turned into a symlink by an earlier entry in the same archive — the
 * standard Zip Slip follow-up where `a/` is a symlink and `a/b` escapes.
 */
export function assertRealDirWithin(extractDirResolved: string, dir: string): void {
  let realDir: string;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    return; // Not created yet — nothing to follow.
  }
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(extractDirResolved);
  } catch {
    return;
  }
  if (!isInside(realRoot, realDir)) {
    throw new Error(`Directory traversal attempt detected in zip file: ${dir}`);
  }
}

/** Absolute path to a repo's working directory. Validates the id first. */
export function repoDir(repoId: string): string {
  if (!isValidRepoId(repoId)) {
    throw new Error('Invalid repository identifier');
  }
  return path.join(CLONES_BASE_DIR, repoId);
}

/** Create the clones base directory if it does not exist. */
export function ensureClonesBaseDir(): string {
  if (!fs.existsSync(CLONES_BASE_DIR)) {
    fs.mkdirSync(CLONES_BASE_DIR, { recursive: true });
  }
  return CLONES_BASE_DIR;
}
