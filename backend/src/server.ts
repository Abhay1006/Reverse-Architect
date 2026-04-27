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
import rateLimit from 'express-rate-limit';

import { parseProject, parseDatabaseSchemas } from './parser/project-parser.js';
import { extractClass } from './parser/extractors/class-extractor.js';
import { extractInterface } from './parser/extractors/interface-extractor.js';
import { extractFunction, extractArrowFunction } from './parser/extractors/function-extractor.js';
import { SyntaxKind } from 'ts-morph';
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

// Multer: store uploads in a temp directory, limit to 50MB
const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ---------------------------------------------------------------------------
//  Rate Limiting
// ---------------------------------------------------------------------------

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Stricter limiter for heavy analysis endpoints
const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // Limit each IP to 30 analysis requests per window
  message: { error: 'Analysis quota exceeded. Please try again or host your own instance.' },
});

app.use('/api/', apiLimiter);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

import { detectEntryPoint, detectAllEntryPoints } from './parser/entry-point.js';

/**
 * Core analysis function: parse project → build graph → layout → serialize.
 * Works on an already-extracted directory path.
 */
function analyzeProjectDir(projectPath: string) {
  // 0. Detect entry points (scanning root and subdirectories)
  const entryPoints = detectAllEntryPoints(projectPath);
  if (entryPoints.length > 0) {
    console.log(`Detected ${entryPoints.length} entry point(s):`);
    for (const ep of entryPoints) {
      console.log(`  - ${ep.entryFile} (${ep.framework})`);
    }
  } else {
    console.log("No entry point detected.");
  }

  // 1. Parse project files and database schemas
  const sourceFiles = parseProject(projectPath);
  const dbFiles = parseDatabaseSchemas(projectPath);

  // Helper: convert absolute file paths to paths relative to the project root
  const toRelativePath = (absPath: string) => {
    const rel = path.relative(projectPath, absPath);
    // Normalize to forward slashes for consistency
    return rel.split(path.sep).join('/');
  };

  // 2. Extract entities from each source file
  const parsedFiles: ParsedFile[] = dbFiles.map(f => ({
    ...f,
    filePath: toRelativePath(f.filePath),
  }));
  for (const file of sourceFiles) {
    const classes = file.getClasses().map(extractClass);
    const interfaces = file.getInterfaces().map(extractInterface);
    const functions = file.getFunctions().map(extractFunction);
    
    const arrowFunctions = file.getVariableDeclarations()
      .filter(v => v.getInitializerIfKind(SyntaxKind.ArrowFunction))
      .map(v => extractArrowFunction(v, v.getInitializerIfKind(SyntaxKind.ArrowFunction)!));
    functions.push(...arrowFunctions);
    
    const imports = file.getImportDeclarations().map(extractImport).map(imp => ({
      ...imp,
      // Fix import resolved path to be relative too!
      resolvedPath: imp.resolvedPath ? toRelativePath(imp.resolvedPath) : undefined
    }));
    const lineCount = file.getEndLineNumber() - file.getStartLineNumber() + 1;

    parsedFiles.push({
      kind: 'file',
      name: file.getBaseName(),
      filePath: toRelativePath(file.getFilePath()),
      classes,
      interfaces,
      functions,
      imports,
      lineCount,
    });
  }

  // 3. Build the architecture graph
  // Pass all entry points to support monorepo BFS from multiple roots
  const entryFileList = entryPoints.map(ep => ep.entryFile);
  const graph = buildGraph(parsedFiles, entryFileList.length > 0 ? entryFileList : undefined);

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
  // Use TB (Top-to-Bottom) layout for trees, instead of LR
  const positioned = computeLayout(graph, {
    direction: entryPoints.length > 0 ? 'TB' : 'LR',
    nodeWidth: 350,
    nodeHeight: 300,
    ranksep: 300,
    nodesep: 200,
  });

  // Create a quick lookup map for parent resolution
  const posNodeMap = new Map<string, typeof positioned.nodes[0]>();
  for (const n of positioned.nodes) {
    posNodeMap.set(n.id, n);
  }

  // 7. Serialize to React Flow format
  const initialNodes: any[] = positioned.nodes.map((n) => {
    
    // React Flow requires child nodes strictly position relatively to their mathematical parent bounding top-left corner
    let relativeX = n.x;
    let relativeY = n.y;
    
    if (n.parentNode) {
      const parentNode = posNodeMap.get(n.parentNode);
      if (parentNode) {
        // Since layout.ts already converted everyone to absolute top-left, we calculate relative offsets directly
        relativeX = n.x - parentNode.x;
        relativeY = n.y - parentNode.y;
      }
    }

    const rfNode: any = {
      id: n.id,
      type: n.type,
      position: { x: relativeX, y: relativeY },
      sourcePosition: 'right',
      targetPosition: 'left',
      data: {
        label: n.label,
        filePath: n.filePath,
        metadata: n.metadata,
        analysis: {
          isGodObject: graph.analysis.godObjects.includes(n.id),
          isDeadCode: graph.analysis.deadCode.includes(n.id),
          isEntryPoint: entryPoints.some(ep => n.filePath === ep.entryFile) && n.type === 'file',
        },
      },
    };
    
    // Assign Dagre boundary sizes directly to DOM styling for Group Nodes
    if (n.style) {
      rfNode.style = n.style;
    }
    
    // Assign mathematical sub-flow nesting parent linkage
    if (n.parentNode) {
      rfNode.parentId = n.parentNode;
      rfNode.extent = 'parent'; // Prevent dragging outside the boundary mathematically
    }

    return rfNode;
  });

  const initialEdges: any[] = positioned.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
  }));

  return {
    nodes: initialNodes,
    edges: initialEdges,
    godObjectDetails: godObjectHits,
    deadCodeDetails: deadCodeHits,
    entryPoint: entryPoints.length > 0 ? entryPoints[0] : null,
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
app.post('/api/analyze/upload', upload.single('file'), analysisLimiter, async (req, res) => {
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
app.post('/api/analyze/github', analysisLimiter, async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "url" field' });
    return;
  }

  // Strict validation for GitHub URLs to prevent SSRF or malformed repos
  const githubUrlRegex = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;
  if (!githubUrlRegex.test(url.trim())) {
    res.status(400).json({ error: 'URL must be a valid GitHub repository (e.g., https://github.com/user/repo)' });
    return;
  }

  const cleanUrl = url.trim();

  const cloneDir = path.join(os.tmpdir(), `atlas-gh-${Date.now()}`);
  try {
    console.log(`Cloning ${cleanUrl} into ${cloneDir}...`);
    const { cloneRepo } = await import('./github/clone.js');
    await cloneRepo(cleanUrl, cloneDir);

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
