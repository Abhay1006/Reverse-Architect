/**
 * Entry Point Detector
 * 
 * Detects the main entry file(s) of a project by reading package.json
 * and applying framework-specific heuristics.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EntryPointResult {
  /** Relative path to the entry file from the project root */
  entryFile: string;
  /** Detected framework */
  framework: 'node' | 'nextjs' | 'vite' | 'express' | 'unknown';
  /** The package name from package.json */
  packageName?: string | undefined;
}

/**
 * Detect the primary entry point of a project.
 * 
 * Detection priority:
 * 1. Framework detection (Next.js, Vite) → use framework conventions
 * 2. package.json "main" field
 * 3. package.json "scripts.start" / "scripts.dev" → parse command
 * 4. Convention scan: index.ts, app.ts, server.ts, etc.
 */
export function detectEntryPoint(projectPath: string): EntryPointResult | null {
  // Try to find and read package.json
  const pkgJsonPath = findPackageJson(projectPath);
  if (!pkgJsonPath) {
    // No package.json — fall back to convention scanning
    return conventionScan(projectPath);
  }

  let pkg: any;
  try {
    const content = fs.readFileSync(pkgJsonPath, 'utf-8');
    pkg = JSON.parse(content);
  } catch {
    return conventionScan(projectPath);
  }

  const pkgDir = path.dirname(pkgJsonPath);
  const packageName = pkg.name as string | undefined;

  // ── Framework Detection ──────────────────────────────────────────────

  // Next.js: check dependencies for "next"
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  if (allDeps['next']) {
    const nextEntry = findNextJsEntry(pkgDir);
    if (nextEntry) {
      return {
        entryFile: path.relative(projectPath, nextEntry),
        framework: 'nextjs',
        packageName,
      };
    }
  }

  // Vite: check for vite in devDependencies
  if (allDeps['vite']) {
    const viteEntry = findViteEntry(pkgDir);
    if (viteEntry) {
      return {
        entryFile: path.relative(projectPath, viteEntry),
        framework: 'vite',
        packageName,
      };
    }
  }

  // Express detection
  if (allDeps['express']) {
    // Express apps usually have main or scripts.start pointing to server file
    const expressEntry = resolveFromPkg(pkg, pkgDir);
    if (expressEntry) {
      return {
        entryFile: path.relative(projectPath, expressEntry),
        framework: 'express',
        packageName,
      };
    }
  }

  // ── Generic Detection ────────────────────────────────────────────────

  // 1. "main" field
  if (pkg.main) {
    const mainFile = resolveEntryFile(pkgDir, pkg.main);
    if (mainFile) {
      return {
        entryFile: path.relative(projectPath, mainFile),
        framework: 'node',
        packageName,
      };
    }
  }

  // 2. "module" field (ESM entry)
  if (pkg.module) {
    const moduleFile = resolveEntryFile(pkgDir, pkg.module);
    if (moduleFile) {
      return {
        entryFile: path.relative(projectPath, moduleFile),
        framework: 'node',
        packageName,
      };
    }
  }

  // 3. Parse scripts.start or scripts.dev
  const scriptEntry = resolveFromPkg(pkg, pkgDir);
  if (scriptEntry) {
    return {
      entryFile: path.relative(projectPath, scriptEntry),
      framework: 'node',
      packageName,
    };
  }

  // 4. Convention scan
  const fallback = conventionScan(pkgDir);
  if (fallback) {
    return {
      ...fallback,
      entryFile: path.relative(projectPath, path.join(pkgDir, fallback.entryFile)),
      packageName,
    };
  }

  return null;
}

/**
 * Find all entry points in a monorepo/multi-package project.
 * Checks root-level and immediate subdirectories for package.json files.
 */
export function detectAllEntryPoints(projectPath: string): EntryPointResult[] {
  const results: EntryPointResult[] = [];

  // Check root
  const rootEntry = detectEntryPoint(projectPath);
  if (rootEntry) {
    results.push(rootEntry);
  }

  // Check immediate subdirectories (e.g., backend/, frontend/)
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

      const subDir = path.join(projectPath, entry.name);
      const subPkgJson = path.join(subDir, 'package.json');
      
      if (fs.existsSync(subPkgJson)) {
        const subEntry = detectEntryPoint(subDir);
        if (subEntry) {
          // Make path relative to project root, not the subdirectory
          results.push({
            ...subEntry,
            entryFile: path.join(entry.name, subEntry.entryFile).split(path.sep).join('/'),
          });
        }
      }
    }
  } catch {
    // ignore read errors
  }

  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Find the nearest package.json, checking the root first */
function findPackageJson(projectPath: string): string | null {
  const direct = path.join(projectPath, 'package.json');
  if (fs.existsSync(direct)) return direct;
  return null;
}

/** Try to resolve a file path from package.json, handling missing extensions */
function resolveEntryFile(baseDir: string, filePath: string): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
  const abs = path.resolve(baseDir, filePath);

  for (const ext of extensions) {
    const candidate = abs + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Try index files in directory
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexFile = path.join(abs, `index${ext}`);
      if (fs.existsSync(indexFile)) return indexFile;
    }
  }

  return null;
}

/** Parse scripts.start or scripts.dev to extract the target file */
function resolveFromPkg(pkg: any, pkgDir: string): string | null {
  const scripts = pkg.scripts || {};

  for (const key of ['start', 'dev', 'serve']) {
    const script = scripts[key] as string | undefined;
    if (!script) continue;

    // Parse: "node dist/server.js" → "dist/server.js"
    // Parse: "ts-node src/server.ts" → "src/server.ts"
    // Parse: "tsx src/server.ts" → "src/server.ts"
    // Parse: "nodemon src/index.ts" → "src/index.ts"
    const parts = script.split(/\s+/).filter(p => !p.startsWith('-'));
    
    // Skip the command itself (node, ts-node, tsx, nodemon, npx, etc.)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]!;
      // Skip flags and known non-file args
      if (part.startsWith('-') || part === 'run') continue;
      // Skip known commands like "next", "vite", "react-scripts"
      if (['next', 'vite', 'react-scripts', 'webpack', 'tsc'].includes(part)) break;

      const resolved = resolveEntryFile(pkgDir, part);
      if (resolved) return resolved;
    }
  }

  return null;
}

/** Find Next.js entry point */
function findNextJsEntry(pkgDir: string): string | null {
  // App Router: app/layout.tsx is the root wrapper
  const appRouterCandidates = [
    'src/app/layout.tsx',
    'src/app/layout.ts',
    'src/app/layout.jsx',
    'src/app/layout.js',
    'app/layout.tsx',
    'app/layout.ts',
    'app/layout.jsx',
    'app/layout.js',
    // Fall back to page if no layout
    'src/app/page.tsx',
    'src/app/page.ts',
    'app/page.tsx',
    'app/page.ts',
  ];

  for (const candidate of appRouterCandidates) {
    const full = path.join(pkgDir, candidate);
    if (fs.existsSync(full)) return full;
  }

  // Pages Router
  const pagesRouterCandidates = [
    'src/pages/_app.tsx',
    'src/pages/_app.ts',
    'src/pages/_app.jsx',
    'src/pages/_app.js',
    'pages/_app.tsx',
    'pages/_app.ts',
    'src/pages/index.tsx',
    'pages/index.tsx',
  ];

  for (const candidate of pagesRouterCandidates) {
    const full = path.join(pkgDir, candidate);
    if (fs.existsSync(full)) return full;
  }

  return null;
}

/** Find Vite entry point */
function findViteEntry(pkgDir: string): string | null {
  const candidates = [
    'src/main.tsx',
    'src/main.ts',
    'src/main.jsx',
    'src/main.js',
    'src/index.tsx',
    'src/index.ts',
    'src/App.tsx',
    'src/App.jsx',
  ];

  for (const candidate of candidates) {
    const full = path.join(pkgDir, candidate);
    if (fs.existsSync(full)) return full;
  }

  return null;
}

/** Convention scan for entry files when no package.json hints are available */
function conventionScan(dir: string): EntryPointResult | null {
  const candidates = [
    'src/index.ts',
    'src/index.tsx',
    'src/index.js',
    'src/app.ts',
    'src/app.tsx',
    'src/app.js',
    'src/server.ts',
    'src/server.js',
    'src/main.ts',
    'src/main.tsx',
    'src/main.js',
    'index.ts',
    'index.tsx',
    'index.js',
    'app.ts',
    'app.js',
    'server.ts',
    'server.js',
  ];

  for (const candidate of candidates) {
    const full = path.join(dir, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return {
        entryFile: candidate,
        framework: 'unknown',
      };
    }
  }

  return null;
}
