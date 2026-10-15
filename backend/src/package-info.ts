import { createRequire } from 'module';

// Resolved at runtime so the version always matches the installed package.
// Works from src/ (tsx) and from dist/backend/src/ (compiled).
const require = createRequire(import.meta.url);

function readVersion(): string {
  for (const candidate of ['../package.json', '../../../package.json']) {
    try {
      const pkg = require(candidate) as { name?: string; version?: string };
      if (pkg.name === 'reverse-architect' && pkg.version) return pkg.version;
    } catch {
      // try the next layout
    }
  }
  return '0.0.0';
}

export const PACKAGE_VERSION = readVersion();
