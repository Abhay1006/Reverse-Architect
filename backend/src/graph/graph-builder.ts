import * as path from 'path';
import type { ArchGraph, ArchNode, ArchEdge, ParsedFile } from '../../../shared/types.js';

/**
 * Manually resolve an import when ts-morph fails (common for JS projects).
 * Takes a relative module specifier and tries to match it against known file paths.
 */
function manualResolveImport(
  importingFilePath: string,
  moduleSpecifier: string,
  fileMap: Map<string, ParsedFile>
): string | undefined {
  // Only handle relative imports
  if (!moduleSpecifier.startsWith('.')) return undefined;

  // Resolve relative to the importing file's directory
  const importingDir = path.dirname(importingFilePath);
  const resolved = path.normalize(path.join(importingDir, moduleSpecifier))
    .split(path.sep).join('/'); // Normalize to forward slashes

  // Try exact match first
  if (fileMap.has(resolved)) return resolved;

  // Try common extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  // Try index files (e.g., import from './utils' → './utils/index.js')
  for (const ext of extensions) {
    const candidate = resolved + '/index' + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  return undefined;
}

/**
 * Builds an ArchGraph from an array of ParsedFile objects.
 * Maps files and their internal entities (classes, interfaces, functions) to nodes,
 * and establishes edges based on imports and inheritance.
 * 
 * If entryFiles are provided, it builds a dependency tree starting from those files
 * by recursively following import statements (BFS). Only reachable files are included.
 * Multiple entry files allow monorepo support (e.g., backend + frontend).
 * 
 * @param files Array of parsed file data from the extractor
 * @param entryFiles Optional array of relative paths to entry files to seed BFS from
 * @returns A complete ArchGraph structure
 */
export function buildGraph(files: ParsedFile[], entryFiles?: string[]): ArchGraph {
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  
  // Quick lookup map for resolution
  const fileMap = new Map<string, ParsedFile>();
  for (const file of files) {
    fileMap.set(file.filePath, file);
  }

  // --- Filter Files by Reachability (BFS) ---
  const reachableFiles = new Set<string>();
  const validEntryFiles = (entryFiles || []).filter(f => fileMap.has(f));
  
  if (validEntryFiles.length > 0) {
    // Tree mode: Follow imports from all entry points (supports monorepos)
    const queue = [...validEntryFiles];
    for (const ef of validEntryFiles) reachableFiles.add(ef);

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const file = fileMap.get(currentPath)!;

      for (const imp of file.imports) {
        // Try ts-morph resolved path first, then manual fallback
        let resolvedTarget = imp.resolvedPath;
        if (!resolvedTarget && imp.moduleSpecifier.startsWith('.')) {
          resolvedTarget = manualResolveImport(file.filePath, imp.moduleSpecifier, fileMap);
        }

        if (resolvedTarget && fileMap.has(resolvedTarget) && !reachableFiles.has(resolvedTarget)) {
          reachableFiles.add(resolvedTarget);
          queue.push(resolvedTarget);
        }
      }
    }
  } else {
    // Flat mode: All files are reachable
    for (const file of files) {
      reachableFiles.add(file.filePath);
    }
  }

  // Helper to generate consistent Node IDs
  const getFileNodeId = (filePath: string) => `file:${filePath}`;
  const getEntityNodeId = (filePath: string, name: string) => `entity:${filePath}:${name}`;
  const getGroupNodeId = (groupName: string) => `group:${groupName}`;

  // --- Step 1: Node Generation ---
  for (const file of files) {
    // Only process reachable files
    if (!reachableFiles.has(file.filePath)) continue;

    // 1.1 Add File Node
    nodes.push({
      id: getFileNodeId(file.filePath),
      label: file.name,
      type: 'file',
      filePath: file.filePath,
      metadata: {
        lineCount: file.lineCount || 0,
        exportCount: file.classes.length + file.interfaces.length + file.functions.length,
        entities: [
          ...file.classes.map(c => ({ name: c.name, type: 'class' })),
          ...file.functions.map(f => ({ name: f.name, type: 'function' })),
          ...file.interfaces.map(i => ({ name: i.name, type: 'interface' }))
        ],
        maxComplexity: Math.max(
          0,
          ...file.functions.map(f => f.complexity),
          ...file.classes.map(c => Math.max(0, ...c.methods.map(m => m.complexity)))
        )
      },
      position: { x: 0, y: 0 }
    });

    // Add Database nodes if they exist
    if (file.databaseTables) {
      for (const table of file.databaseTables) {
        nodes.push({
          id: getEntityNodeId(file.filePath, table.name),
          label: table.name,
          type: 'database',
          filePath: file.filePath,
          parentNode: getFileNodeId(file.filePath),
          metadata: {
            lineCount: table.lineCount || 0,
            exportCount: 0,
            maxComplexity: 0
          },
          position: { x: 0, y: 0 }
        });
      }
    }

    // 1.2 Add Entity Nodes (Classes)
    for (const cls of file.classes) {
      nodes.push({
        id: getEntityNodeId(file.filePath, cls.name),
        label: cls.name,
        type: 'class',
        filePath: file.filePath,
        parentNode: getFileNodeId(file.filePath),
        metadata: {
          properties: cls.properties.map(p => p.name),
          methods: cls.methods.map(m => m.name),
          lineCount: cls.lineCount || 0,
          exportCount: 0,
          maxComplexity: Math.max(0, ...cls.methods.map(m => m.complexity))
        },
        position: { x: 0, y: 0 }
      });
    }

    // 1.3 Add Entity Nodes (Interfaces)
    for (const intf of file.interfaces) {
      nodes.push({
        id: getEntityNodeId(file.filePath, intf.name),
        label: intf.name,
        type: 'interface',
        filePath: file.filePath,
        parentNode: getFileNodeId(file.filePath),
        metadata: {
          properties: intf.properties.map(p => p.name),
          methods: intf.methods.map(m => m.name),
          lineCount: intf.lineCount || 0,
          exportCount: 0,
          maxComplexity: 0
        },
        position: { x: 0, y: 0 }
      });
    }

    // 1.4 Add Entity Nodes (Functions)
    for (const fn of file.functions) {
       nodes.push({
        id: getEntityNodeId(file.filePath, fn.name),
        label: fn.name,
        type: 'function',
        filePath: file.filePath,
        parentNode: getFileNodeId(file.filePath),
        metadata: {
          lineCount: fn.lineCount || 0,
          exportCount: 0,
          maxComplexity: fn.complexity
        },
        position: { x: 0, y: 0 }
      });
    }
  }

  // --- Step 2: Edge Generation ---
  const edgeIds = new Set<string>(); // Track edge IDs to prevent duplicates

  for (const file of files) {
    if (!reachableFiles.has(file.filePath)) continue;

    // 2.1 File-level Import Edges
    for (const imp of file.imports) {
      // Try ts-morph resolved path first, then manual fallback
      let resolvedTarget = imp.resolvedPath;
      if (!resolvedTarget && imp.moduleSpecifier.startsWith('.')) {
        resolvedTarget = manualResolveImport(file.filePath, imp.moduleSpecifier, fileMap);
      }

      if (resolvedTarget && reachableFiles.has(resolvedTarget)) {
        const edgeId = `edge:import:${file.filePath}->${resolvedTarget}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({
            id: edgeId,
            source: getFileNodeId(file.filePath),
            target: getFileNodeId(resolvedTarget),
            type: 'import',
            label: imp.moduleSpecifier
          });
        }
      }
    }

    /**
     * Helper to resolve where an entity (by name) is defined
     */
    const resolveEntityNodeId = (name: string, sourceFile: ParsedFile): string | null => {
      // Look in same file first
      const sameFileClass = sourceFile.classes.find(c => c.name === name);
      if (sameFileClass) return getEntityNodeId(sourceFile.filePath, name);

      const sameFileInterface = sourceFile.interfaces.find(i => i.name === name);
      if (sameFileInterface) return getEntityNodeId(sourceFile.filePath, name);

      const sameFileFunction = sourceFile.functions.find(f => f.name === name);
      if (sameFileFunction) return getEntityNodeId(sourceFile.filePath, name);

      // Look in imports
      for (const imp of sourceFile.imports) {
        if (!imp.resolvedPath || !reachableFiles.has(imp.resolvedPath)) continue;

        const isNamedImport = imp.namedImports.includes(name);
        const isDefaultImport = imp.defaultImport === name;

        if (isNamedImport || isDefaultImport) {
          // Verify the entity actually exists in the target file
          const targetFile = fileMap.get(imp.resolvedPath)!;
          const targetExists = targetFile.classes.some(c => c.name === name) || 
                               targetFile.interfaces.some(i => i.name === name) ||
                               targetFile.functions.some(f => f.name === name);
          
          if (targetExists) {
            return getEntityNodeId(imp.resolvedPath, name);
          }
        }
      }
      return null;
    };

    // 2.2 Entity-level Inheritance Edges
    for (const cls of file.classes) {
      if (cls.extends) {
        const targetId = resolveEntityNodeId(cls.extends, file);
        if (targetId) {
          edges.push({
            id: `edge:extends:${getEntityNodeId(file.filePath, cls.name)}->${targetId}`,
            source: getEntityNodeId(file.filePath, cls.name),
            target: targetId,
            type: 'extends'
          });
        }
      }
      for (const impl of cls.implements) {
        const targetId = resolveEntityNodeId(impl, file);
        if (targetId) {
          edges.push({
            id: `edge:implements:${getEntityNodeId(file.filePath, cls.name)}->${targetId}`,
            source: getEntityNodeId(file.filePath, cls.name),
            target: targetId,
            type: 'implements'
          });
        }
      }
    }

    for (const intf of file.interfaces) {
      for (const base of intf.extends) {
        const targetId = resolveEntityNodeId(base, file);
        if (targetId) {
          edges.push({
            id: `edge:extends:${getEntityNodeId(file.filePath, intf.name)}->${targetId}`,
            source: getEntityNodeId(file.filePath, intf.name),
            target: targetId,
            type: 'extends'
          });
        }
      }
    }

    // 2.3 Entity-level Call Edges (Execution Flow)
    const addCallEdges = (sourceId: string, calledNames: string[] | undefined) => {
      if (!calledNames) return;
      for (const calledName of calledNames) {
        const targetId = resolveEntityNodeId(calledName, file);
        if (targetId) {
          const edgeId = `edge:calls:${sourceId}->${targetId}`;
          if (!edgeIds.has(edgeId)) {
            edgeIds.add(edgeId);
            edges.push({
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: 'calls',
              label: 'calls'
            });
          }
        }
      }
    };

    for (const fn of file.functions) {
      addCallEdges(getEntityNodeId(file.filePath, fn.name), fn.calledFunctions);
    }
    
    for (const cls of file.classes) {
      for (const method of cls.methods) {
        // Here we map method calls from inside the class as originating from the class itself for simplicity at the graph level,
        // unless we want to render method nodes. Since we render class nodes, we link calls from the class.
        addCallEdges(getEntityNodeId(file.filePath, cls.name), method.calledFunctions);
      }
    }
  }

  // --- Step 3: Importance Scoring ---
  // Calculate in-degree and out-degree for each file
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  
  for (const edge of edges) {
    if (edge.type === 'import') {
      outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
      inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
    }
  }

  for (const node of nodes) {
    if (node.type === 'file') {
      const inDegree = inDegreeMap.get(node.id) || 0;
      const outDegree = outDegreeMap.get(node.id) || 0;
      
      // Basic heuristic: heavily used files (high in-degree) are important core modules.
      // Files that coordinate a lot (high out-degree) are important controllers.
      // High complexity and export counts also boost importance.
      let score = (inDegree * 3) + (outDegree * 1) + (node.metadata.exportCount * 0.5) + (node.metadata.maxComplexity * 0.2);
      
      // Bonus if it's an entry point or index file
      if (node.filePath.endsWith('index.js') || node.filePath.endsWith('index.ts')) {
        score += 5;
      }
      
      node.metadata.importanceScore = Math.round(score * 10) / 10;
    }
  }

  return {
    nodes,
    edges,
    analysis: {
      godObjects: [],
      deadCode: [],
      cycles: [],
      patterns: []
    }
  };
}
