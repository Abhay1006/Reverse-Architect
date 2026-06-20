import { describe, it, expect } from 'vitest';
import path from 'path';

function validateZipEntry(extractDirResolved: string, entryName: string): string {
  const targetPath = path.resolve(extractDirResolved, entryName);
  const relative = path.relative(extractDirResolved, targetPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Directory traversal attempt detected in zip file: ${entryName}`);
  }
  return targetPath;
}

function sanitizePath(input: string): string {
  return path.normalize(input).replace(/^(\.\.(\/|\\|$))+/, '');
}

describe('Security Sanitization', () => {
  describe('Zip Slip Prevention', () => {
    const extractDir = '/safe/extract/dir';

    it('should resolve safe paths within the extract directory', () => {
      const resolved = validateZipEntry(extractDir, 'src/index.ts');
      expect(resolved).toContain('index.ts');
    });

    it('should block paths attempting to escape the extract directory using dot-dot-slash', () => {
      expect(() => validateZipEntry(extractDir, '../../etc/passwd')).toThrow(
        'Directory traversal attempt detected in zip file: ../../etc/passwd'
      );
    });

    it('should block absolute paths attempting to write outside extract directory', () => {
      expect(() => validateZipEntry(extractDir, '/etc/passwd')).toThrow();
    });
  });

  describe('Path Traversal Prevention in Code Peek', () => {
    it('should strip leading directory traversal patterns', () => {
      expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('should keep harmless relative paths intact', () => {
      expect(sanitizePath('src/components/Canvas.tsx')).toBe('src/components/Canvas.tsx');
    });
  });
});
