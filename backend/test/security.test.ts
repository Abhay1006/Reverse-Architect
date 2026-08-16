import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// These are the SAME functions the route handlers call. The previous version of
// this file re-implemented them locally, so it would have stayed green even if
// the real containment checks were removed.
import {
  validateZipEntry,
  sanitizeRelativePath,
  resolveWithinRoot,
  isInside,
  isValidRepoId,
} from '../src/api/path-safety.js';

describe('Security Sanitization', () => {
  describe('Zip Slip Prevention', () => {
    const extractDir = path.resolve('/safe/extract/dir');

    it('should resolve safe paths within the extract directory', () => {
      const resolved = validateZipEntry(extractDir, 'src/index.ts');
      expect(resolved).toContain('index.ts');
      expect(isInside(extractDir, resolved)).toBe(true);
    });

    it('should block paths attempting to escape the extract directory using dot-dot-slash', () => {
      expect(() => validateZipEntry(extractDir, '../../etc/passwd')).toThrow(
        'Directory traversal attempt detected in zip file: ../../etc/passwd'
      );
    });

    it('should block absolute paths attempting to write outside extract directory', () => {
      expect(() => validateZipEntry(extractDir, '/etc/passwd')).toThrow();
    });

    it('should block traversal buried mid-path', () => {
      expect(() => validateZipEntry(extractDir, 'src/../../../etc/passwd')).toThrow();
    });
  });

  describe('sanitizeRelativePath', () => {
    it('should strip leading directory traversal patterns', () => {
      expect(sanitizeRelativePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('should keep harmless relative paths intact', () => {
      expect(sanitizeRelativePath('src/components/Canvas.tsx')).toBe('src/components/Canvas.tsx');
    });
  });

  describe('isInside', () => {
    it('should accept a genuine descendant', () => {
      expect(isInside('/a/repo', '/a/repo/src/x.ts')).toBe(true);
    });

    it('should accept the root itself', () => {
      expect(isInside('/a/repo', '/a/repo')).toBe(true);
    });

    it('should reject a sibling directory that merely shares a prefix', () => {
      // The old `startsWith` check accepted this.
      expect(isInside('/a/repo', '/a/repo-evil/secrets.txt')).toBe(false);
    });

    it('should reject a parent directory', () => {
      expect(isInside('/a/repo', '/a')).toBe(false);
    });
  });

  describe('isValidRepoId', () => {
    it('should accept owner/repo', () => {
      expect(isValidRepoId('facebook/react')).toBe(true);
      expect(isValidRepoId('some-user/my.repo')).toBe(true);
    });

    it('should accept an upload id', () => {
      expect(isValidRepoId('upload-1699999999999')).toBe(true);
    });

    it('should reject traversal attempts', () => {
      // This is the input that turned POST /api/ai/chat into an arbitrary file read.
      expect(isValidRepoId('../../../../etc')).toBe(false);
      expect(isValidRepoId('../..')).toBe(false);
      expect(isValidRepoId('owner/../../etc')).toBe(false);
      expect(isValidRepoId('/etc/passwd')).toBe(false);
    });

    it('should reject wrong shapes and non-strings', () => {
      expect(isValidRepoId('justonesegment')).toBe(false);
      expect(isValidRepoId('a/b/c')).toBe(false);
      expect(isValidRepoId('')).toBe(false);
      expect(isValidRepoId(undefined)).toBe(false);
      expect(isValidRepoId(42)).toBe(false);
    });
  });

  describe('resolveWithinRoot (symlink containment)', () => {
    let tmpRoot: string;
    let repoDir: string;
    let secretFile: string;

    beforeAll(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-sec-'));
      repoDir = path.join(tmpRoot, 'repo');
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const a = 1;');

      secretFile = path.join(tmpRoot, 'secret.txt');
      fs.writeFileSync(secretFile, 'PRIVATE KEY');
    });

    afterAll(() => {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('should resolve a real file inside the repo', () => {
      const resolved = resolveWithinRoot(repoDir, 'src/index.ts');
      expect(resolved).not.toBeNull();
      expect(fs.readFileSync(resolved!, 'utf8')).toContain('export const a');
    });

    it('should return null for a path that escapes via ..', () => {
      expect(resolveWithinRoot(repoDir, '../secret.txt')).toBeNull();
    });

    it('should return null for a missing file', () => {
      expect(resolveWithinRoot(repoDir, 'src/nope.ts')).toBeNull();
    });

    it('should refuse to follow a symlink pointing outside the repo', () => {
      // A cloned repository is attacker-controlled content: it can contain a
      // symlink to anything on the host.
      const link = path.join(repoDir, 'leak.txt');
      try {
        fs.symlinkSync(secretFile, link);
      } catch {
        return; // Platform without symlink permission — nothing to assert.
      }

      // A purely lexical check would accept this path.
      expect(isInside(repoDir, path.resolve(repoDir, 'leak.txt'))).toBe(true);
      // The real check follows the link and rejects it.
      expect(resolveWithinRoot(repoDir, 'leak.txt')).toBeNull();
    });

    it('should refuse a file reached through a symlinked directory', () => {
      const linkDir = path.join(repoDir, 'escape');
      try {
        fs.symlinkSync(tmpRoot, linkDir, 'dir');
      } catch {
        return;
      }
      expect(resolveWithinRoot(repoDir, 'escape/secret.txt')).toBeNull();
    });
  });
});
