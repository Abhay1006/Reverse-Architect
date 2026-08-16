import path from 'path';
import fs from 'fs';
import type { AnalysisResponse, WireNode, WireEdge } from 'shared';
import { CLONES_BASE_DIR, isValidRepoId, resolveWithinRoot, isInside } from '../api/path-safety.js';

/** A node as seen by the context builder, with the label/path fields flattened. */
interface ContextNode {
  id: string;
  label: string;
  type: string;
  filePath: string;
  importanceScore: number;
  methods?: string[] | undefined;
}

function toContextNodes(nodes: WireNode[]): ContextNode[] {
  return nodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    type: n.type,
    filePath: n.data.filePath,
    importanceScore: n.data.metadata.importanceScore ?? 0,
    methods: n.data.metadata.methods,
  }));
}

export function buildRepoContext(
  repoId: string,
  graph: AnalysisResponse | null
): string {
  if (!graph) {
    return `Repository: ${repoId}\nNo architecture graph metadata available.`;
  }

  const nodes = toContextNodes(graph.nodes ?? []);
  const edges: WireEdge[] = graph.edges ?? [];

  // Group nodes by type
  const files = nodes.filter(n => n.type === 'file');
  const classes = nodes.filter(n => n.type === 'class');
  const interfaces = nodes.filter(n => n.type === 'interface');
  const functions = nodes.filter(n => n.type === 'function');
  const databases = nodes.filter(n => n.type === 'database');

  let markdown = `# Architecture Context for Repository: ${repoId}\n\n`;

  markdown += `## Summary of Entities\n`;
  markdown += `- Files: ${files.length}\n`;
  markdown += `- Classes: ${classes.length}\n`;
  markdown += `- Interfaces: ${interfaces.length}\n`;
  markdown += `- Functions: ${functions.length}\n`;
  markdown += `- Database Tables/Schemas: ${databases.length}\n\n`;

  markdown += `## File Directory & Symbol Outline\n`;
  // List files and their child symbols. Ranked by importance so the truncation
  // below keeps the architecturally significant files rather than whichever
  // ones happen to sort first.
  const rankedFiles = [...files].sort((a, b) => b.importanceScore - a.importanceScore);
  rankedFiles.slice(0, 50).forEach(fileNode => {
    markdown += `- File: \`${fileNode.filePath || fileNode.label}\`\n`;
    
    // Find nested classes/functions in this file (matching by file path or parentNode)
    const fileClasses = classes.filter(c => c.filePath === fileNode.filePath);
    const fileFunctions = functions.filter(f => f.filePath === fileNode.filePath);
    const fileInterfaces = interfaces.filter(i => i.filePath === fileNode.filePath);

    if (fileClasses.length > 0) {
      markdown += `  - Classes:\n`;
      fileClasses.forEach(c => {
        markdown += `    - \`class ${c.label}\`${c.methods?.length ? ` with methods: [${c.methods.join(', ')}]` : ''}\n`;
      });
    }
    if (fileInterfaces.length > 0) {
      markdown += `  - Interfaces:\n`;
      fileInterfaces.forEach(i => {
        markdown += `    - \`interface ${i.label}\`\n`;
      });
    }
    if (fileFunctions.length > 0) {
      markdown += `  - Functions: ${fileFunctions.map(f => `\`${f.label}\``).join(', ')}\n`;
    }
  });

  if (files.length > 50) {
    markdown += `\n... and ${files.length - 50} more files.\n`;
  }

  // Add relations / Edges (sample of key dependencies)
  if (edges.length > 0) {
    markdown += `\n## Key Architectural Relations\n`;
    const importEdges = edges.filter(e => e.relation === 'import');
    const callEdges = edges.filter(e => e.relation === 'calls');
    const inheritanceEdges = edges.filter(e => e.relation === 'extends' || e.relation === 'implements');

    if (importEdges.length > 0) {
      markdown += `### Import Dependencies (Sample)\n`;
      importEdges.slice(0, 15).forEach(e => {
        markdown += `- \`${e.source}\` imports \`${e.target}\`\n`;
      });
    }

    if (inheritanceEdges.length > 0) {
      markdown += `### Class/Interface Hierarchy\n`;
      inheritanceEdges.slice(0, 15).forEach(e => {
        markdown += `- \`${e.source}\` ${e.relation} \`${e.target}\`\n`;
      });
    }

    if (callEdges.length > 0) {
      markdown += `### Core Function Calls (Sample)\n`;
      callEdges.slice(0, 15).forEach(e => {
        markdown += `- \`${e.source}\` calls \`${e.target}\`\n`;
      });
    }
  }

  // Add analysis flags
  markdown += `\n## Architectural Analysis Issues & Quality Flags\n`;

  const godObjects = graph.godObjectDetails ?? [];
  if (godObjects.length > 0) {
    markdown += `### God Objects (heavily coupled entities):\n`;
    godObjects.slice(0, 20).forEach((god) => {
      markdown += `- \`${god.label}\` (in: ${god.inDegree}, out: ${god.outDegree}, total degree: ${god.totalDegree})\n`;
    });
  } else {
    markdown += `- No major God Objects detected.\n`;
  }

  const deadCode = graph.deadCodeDetails ?? [];
  if (deadCode.length > 0) {
    markdown += `### Dead Code Candidates (Unreferenced exports):\n`;
    deadCode.slice(0, 15).forEach((dead) => {
      markdown += `- \`${dead.label}\` (${dead.nodeType}) in \`${dead.filePath}\`\n`;
    });
    if (deadCode.length > 15) {
      markdown += `- ... and ${deadCode.length - 15} more unreferenced items.\n`;
    }
  } else {
    markdown += `- No dead code candidates flagged.\n`;
  }

  // Cycles and design patterns come from the analysis block, which the
  // backend now actually sends.
  const cycles = graph.analysis?.cycles ?? [];
  if (cycles.length > 0) {
    markdown += `### Circular Dependencies:\n`;
    cycles.slice(0, 10).forEach((cycle) => {
      markdown += `- ${cycle.join(' → ')}\n`;
    });
  }

  const patterns = graph.analysis?.patterns ?? [];
  if (patterns.length > 0) {
    markdown += `### Detected Design Patterns:\n`;
    patterns.slice(0, 20).forEach((p) => {
      markdown += `- \`${p.nodeId}\`: ${p.pattern} (${p.confidence} confidence)\n`;
    });
  }

  return markdown;
}

/**
 * Scan message for filenames, find matching files in cloned repo,
 * and extract their content as context.
 */
/** Directories never worth scanning for AI context. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 'vendor', 'target']);

/**
 * Cached file listing per repo. The walk used to run on every single chat
 * message, which is O(repo size) per keystroke-sized request.
 */
const fileListCache = new Map<string, { files: string[]; expiresAt: number }>();
const FILE_LIST_TTL_MS = 5 * 60 * 1000;

function listRepoFiles(repoPath: string): string[] {
  const cached = fileListCache.get(repoPath);
  if (cached && cached.expiresAt > Date.now()) return cached.files;

  const allFiles: string[] = [];
  const MAX_FILES = 20_000;

  const walk = (dir: string, depth: number) => {
    if (depth > 12 || allFiles.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (allFiles.length >= MAX_FILES) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        // isFile() is false for symlinks, so links out of the repo are skipped.
        allFiles.push(fullPath);
      }
    }
  };

  walk(repoPath, 0);
  fileListCache.set(repoPath, { files: allFiles, expiresAt: Date.now() + FILE_LIST_TTL_MS });
  return allFiles;
}

export function findAndLoadRelevantFiles(repoId: string, message: string): string {
  // repoId is interpolated into a filesystem path — reject anything that is
  // not a plain owner/repo or upload id before touching the disk.
  if (!isValidRepoId(repoId)) return '';

  const repoPath = path.join(CLONES_BASE_DIR, repoId);
  if (!isInside(CLONES_BASE_DIR, repoPath) || !fs.existsSync(repoPath)) {
    return '';
  }

  const allFiles = listRepoFiles(repoPath);

  // Parse message for possible file mentions (e.g. "routes.ts", "src/server.ts")
  const fileMentions: string[] = [];
  const words = message.split(/[\s,()'"`;]+/);

  for (const word of words) {
    if (word.includes('.') && word.length > 3) {
      // Find files whose path ends with this word
      const normalizedWord = word.replace(/^[./\\]+/, '');
      const match = allFiles.find(f => {
        const rel = path.relative(repoPath, f);
        return rel.toLowerCase() === normalizedWord.toLowerCase() || 
               path.basename(f).toLowerCase() === normalizedWord.toLowerCase();
      });

      if (match && !fileMentions.includes(match)) {
        fileMentions.push(match);
      }
    }
  }

  if (fileMentions.length === 0) {
    return '';
  }

  let codeContext = `\n## Relevant Source Code Files for User Question\n`;
  let loadedCount = 0;

  for (const filePath of fileMentions) {
    if (loadedCount >= 5) break; // Limit to 5 files to avoid token limits
    try {
      // Final containment check against the real path: the listing is built
      // from this repo's tree, but re-verify before reading anything out.
      const safePath = resolveWithinRoot(repoPath, path.relative(repoPath, filePath));
      if (!safePath) continue;

      const stats = fs.statSync(safePath);
      if (stats.size > 50 * 1024) continue; // Don't load files larger than 50KB

      const content = fs.readFileSync(safePath, 'utf8');
      const relativePath = path.relative(repoPath, safePath);
      const ext = path.extname(safePath).substring(1) || 'text';

      codeContext += `### File: \`${relativePath}\`\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
      loadedCount++;
    } catch {
      // ignore read errors
    }
  }

  return codeContext;
}
