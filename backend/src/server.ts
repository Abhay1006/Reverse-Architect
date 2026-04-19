// ============================================================
//  Atlas-TS — Backend Express API Server
//  Exposes endpoints for analyzing TypeScript/JavaScript projects
//  via file upload (.zip) or GitHub URL.
// ============================================================

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';

import { parseProject } from './parser/project-parser.js';
import { extractClass } from './parser/extractors/class-extractor.js';
import { extractInterface } from './parser/extractors/interface-extractor.js';
import { extractFunction } from './parser/extractors/function-extractor.js';
import { extractImport } from './parser/extractors/import-extractor.js';
import { buildGraph } from './graph/graph-builder.js';
import { computeLayout } from './graph/layout.js';
import { serializeToReactFlow } from './graph/serialize.js';
import { detectGodObjects } from './analyzers/god-object.js';
import { detectDeadCode } from './analyzers/dead-code.js';
import { detectCycles } from './graph/algorithms/cycle-detection.js';
import { detectPatterns } from './analyzers/patterns/index.js';
import type { ParsedFile } from '../../shared/types.js';

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const app = express();

app.use(cors());
app.use(express.json());

// Multer: store uploads in a temp directory
const upload = multer({ dest: os.tmpdir() });

// ---------------------------------------------------------------------------
//  Analysis Pipeline
// ---------------------------------------------------------------------------

/**
 * Core analysis function: parse project → build graph → layout → serialize.
 * Works on an already-extracted directory path.
 */
function analyzeProjectDir(projectPath: string) {
  // 1. Parse project files
  const sourceFiles = parseProject(projectPath);

  // 2. Extract entities from each source file
  const parsedFiles: ParsedFile[] = [];
  for (const file of sourceFiles) {
    const classes = file.getClasses().map(extractClass);
    const interfaces = file.getInterfaces().map(extractInterface);
    const functions = file.getFunctions().map(extractFunction);
    const imports = file.getImportDeclarations().map(extractImport);

    parsedFiles.push({
      kind: 'file',
      name: file.getBaseName(),
      filePath: file.getFilePath(),
      classes,
      interfaces,
      functions,
      imports,
    });
  }

  // 3. Build the architecture graph
  const graph = buildGraph(parsedFiles);

  // 4. Run god-object detection and populate analysis
  const godObjectHits = detectGodObjects(graph);
  graph.analysis.godObjects = godObjectHits.map((h) => h.nodeId);

  // 5. Run dead-code detection and populate analysis
  const deadCodeHits = detectDeadCode(graph);
  graph.analysis.deadCode = deadCodeHits.map((h) => h.nodeId);

  // 6. Run cycle detection
  graph.analysis.cycles = detectCycles(graph);

  // 7. Run design pattern detection
  graph.analysis.patterns = detectPatterns(graph);

  // 8. Compute layout positions
  const positioned = computeLayout(graph, {
    direction: 'TB',
    nodeWidth: 200,
    nodeHeight: 80,
    ranksep: 80,
    nodesep: 60,
  });

  // 7. Serialize to React Flow format
  const result = serializeToReactFlow(positioned);

  // Attach enriched analysis data for the sidebar
  return {
    ...result,
    godObjectDetails: godObjectHits,
    deadCodeDetails: deadCodeHits,
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

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
  // If there's a single directory entry, drill into it
  if (entries.length === 1) {
    const child = path.join(extractedDir, entries[0]!);
    if (fs.statSync(child).isDirectory()) {
      return child;
    }
  }
  return extractedDir;
}

// ---------------------------------------------------------------------------
//  Routes
// ---------------------------------------------------------------------------

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** POST /api/analyze/upload — accept a .zip file */
app.post('/api/analyze/upload', upload.single('file'), async (req, res) => {
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

  const extractDir = path.join(os.tmpdir(), `atlas-${Date.now()}`);
  try {
    // Extract the zip
    const zip = new AdmZip(file.path);
    zip.extractAllTo(extractDir, true);

    // Find root and analyze
    const projectRoot = findProjectRoot(extractDir);
    const result = analyzeProjectDir(projectRoot);

    res.json(result);
  } catch (err: unknown) {
    console.error('[/api/analyze/upload] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Analysis failed', details: message });
  } finally {
    // Cleanup temp files
    cleanup(file.path);
    cleanup(extractDir);
  }
});

/** POST /api/analyze/github — clone and analyze a GitHub repo */
app.post('/api/analyze/github', async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "url" field' });
    return;
  }

  if (!url.includes('github.com')) {
    res.status(400).json({ error: 'URL must be a GitHub repository' });
    return;
  }

  const cloneDir = path.join(os.tmpdir(), `atlas-gh-${Date.now()}`);
  try {
    // Clone the repo using git (shallow clone for speed)
    const { execSync } = await import('child_process');
    console.log(`Cloning ${url} into ${cloneDir}...`);
    execSync(`git clone --depth 1 ${url} ${cloneDir}`, {
      stdio: 'pipe',
      timeout: 60_000, // 60 second timeout
    });

    const result = analyzeProjectDir(cloneDir);
    res.json(result);
  } catch (err: unknown) {
    console.error('[/api/analyze/github] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Analysis failed', details: message });
  } finally {
    cleanup(cloneDir);
  }
});

// ---------------------------------------------------------------------------
//  Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n🏛️  Atlas-TS backend running on http://localhost:${PORT}`);
  console.log(`   POST /api/analyze/upload   — Upload .zip`);
  console.log(`   POST /api/analyze/github   — Analyze GitHub repo`);
  console.log(`   GET  /api/health           — Health check\n`);
});
