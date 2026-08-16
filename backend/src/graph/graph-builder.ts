import * as path from 'path';
import { importCandidatePaths, SOURCE_EXTENSIONS } from './import-candidates.js';
import type { ArchGraph, ArchNode, ArchEdge, ParsedFile } from 'shared';

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

  // importCandidatePaths handles exact matches, TypeScript's `.js`-means-`.ts`
  // ESM convention, bare specifiers, and index files.
  const extensions = [
    ...SOURCE_EXTENSIONS,
    '.py', '.go', '.rs', '.java', '.rb', '.php', '.kt', '.swift', '.cs',
  ];
  for (const candidate of importCandidatePaths(resolved, extensions)) {
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

  // Build a reverse lookup: for each import, what names does this file bring in from which file?
  // This is crucial for resolving calls across files
  const importedNamesMap = new Map<string, Map<string, string>>(); // filePath -> Map<importedName, sourceFilePath>
  
  for (const file of files) {
    if (!reachableFiles.has(file.filePath)) continue;
    const namesMap = new Map<string, string>();
    
    for (const imp of file.imports) {
      let resolvedTarget = imp.resolvedPath;
      if (!resolvedTarget && imp.moduleSpecifier.startsWith('.')) {
        resolvedTarget = manualResolveImport(file.filePath, imp.moduleSpecifier, fileMap);
      }
      if (!resolvedTarget || !reachableFiles.has(resolvedTarget)) continue;
      
      // Track named imports
      for (const name of imp.namedImports) {
        namesMap.set(name, resolvedTarget);
      }
      // Track default import
      if (imp.defaultImport) {
        namesMap.set(imp.defaultImport, resolvedTarget);
      }
      // Track namespace import (e.g. import * as utils from './utils')
      if (imp.namespaceImport) {
        namesMap.set(imp.namespaceImport, resolvedTarget);
      }
    }
    
    importedNamesMap.set(file.filePath, namesMap);
  }

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
            label: 'imports'
          });
        }
      }
    }

    /**
     * Helper to resolve where an entity (by name) is defined.
     * Enhanced to handle CommonJS, namespace imports, and fuzzy matching.
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
        let resolvedPath = imp.resolvedPath;
        if (!resolvedPath && imp.moduleSpecifier.startsWith('.')) {
          resolvedPath = manualResolveImport(sourceFile.filePath, imp.moduleSpecifier, fileMap);
        }
        if (!resolvedPath || !reachableFiles.has(resolvedPath)) continue;

        const isNamedImport = imp.namedImports.includes(name);
        const isDefaultImport = imp.defaultImport === name;

        if (isNamedImport || isDefaultImport) {
          const targetFile = fileMap.get(resolvedPath);
          if (!targetFile) continue;
          
          // Check if the entity exists in the target file
          const targetExists = targetFile.classes.some(c => c.name === name) || 
                               targetFile.interfaces.some(i => i.name === name) ||
                               targetFile.functions.some(f => f.name === name);
          
          if (targetExists) {
            return getEntityNodeId(resolvedPath, name);
          }
          
          // For default imports, match the first exported entity
          if (isDefaultImport) {
            const exportedFn = targetFile.functions.find(f => f.isExported);
            if (exportedFn) return getEntityNodeId(resolvedPath, exportedFn.name);
            const exportedCls = targetFile.classes.find(c => c.isExported);
            if (exportedCls) return getEntityNodeId(resolvedPath, exportedCls.name);
          }
        }
      }

      // Fallback: Global lookup (essential for module-less package styles like Swift/Go/Java/Kotlin)
      for (const otherFile of files) {
        if (otherFile.filePath === sourceFile.filePath) continue;
        const targetExists = otherFile.classes.some(c => c.name === name) || 
                             otherFile.interfaces.some(i => i.name === name) ||
                             otherFile.functions.some(f => f.name === name);
        if (targetExists) {
          return getEntityNodeId(otherFile.filePath, name);
        }
      }

      return null;
    };

    /**
     * Resolve a called function name to a target file path.
     * Used to create file-level "calls" edges when entity-level resolution fails.
     */
    const resolveCallToFile = (calledName: string, sourceFile: ParsedFile): string | null => {
      const namesMap = importedNamesMap.get(sourceFile.filePath);
      if (namesMap && namesMap.has(calledName)) {
        return namesMap.get(calledName)!;
      }
      
      // Fallback: Global lookup for any other file declaring this entity
      for (const otherFile of files) {
        if (otherFile.filePath === sourceFile.filePath) continue;
        const declares = otherFile.classes.some(c => c.name === calledName) ||
                         otherFile.interfaces.some(i => i.name === calledName) ||
                         otherFile.functions.some(f => f.name === calledName);
        if (declares) {
          return otherFile.filePath;
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

          // Generate corresponding file-level extends edge
          const targetFilePath = targetId.split(':')[1];
          if (targetFilePath && targetFilePath !== file.filePath) {
            const fileEdgeId = `edge:extends:${getFileNodeId(file.filePath)}->${getFileNodeId(targetFilePath)}`;
            if (!edgeIds.has(fileEdgeId)) {
              edgeIds.add(fileEdgeId);
              edges.push({
                id: fileEdgeId,
                source: getFileNodeId(file.filePath),
                target: getFileNodeId(targetFilePath),
                type: 'extends',
                label: 'extends'
              });
            }
          }
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

          // Generate corresponding file-level implements edge
          const targetFilePath = targetId.split(':')[1];
          if (targetFilePath && targetFilePath !== file.filePath) {
            const fileEdgeId = `edge:implements:${getFileNodeId(file.filePath)}->${getFileNodeId(targetFilePath)}`;
            if (!edgeIds.has(fileEdgeId)) {
              edgeIds.add(fileEdgeId);
              edges.push({
                id: fileEdgeId,
                source: getFileNodeId(file.filePath),
                target: getFileNodeId(targetFilePath),
                type: 'implements',
                label: 'implements'
              });
            }
          }
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

          // Generate corresponding file-level extends edge
          const targetFilePath = targetId.split(':')[1];
          if (targetFilePath && targetFilePath !== file.filePath) {
            const fileEdgeId = `edge:extends:${getFileNodeId(file.filePath)}->${getFileNodeId(targetFilePath)}`;
            if (!edgeIds.has(fileEdgeId)) {
              edgeIds.add(fileEdgeId);
              edges.push({
                id: fileEdgeId,
                source: getFileNodeId(file.filePath),
                target: getFileNodeId(targetFilePath),
                type: 'extends',
                label: 'extends'
              });
            }
          }
        }
      }
    }

    // 2.3 Call Edges — both entity-level and file-level
    const fileCallTargets = new Set<string>(); // Track file-level call targets to avoid duplicates
    
    const addCallEdges = (sourceId: string, calledNames: string[] | undefined) => {
      if (!calledNames) return;
      for (const calledName of calledNames) {
        // Try entity-level resolution first
        const targetId = resolveEntityNodeId(calledName, file);
        if (targetId && targetId !== sourceId) {
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

          // Generate corresponding file-level calls edge
          const targetFilePath = targetId.split(':')[1];
          if (targetFilePath && targetFilePath !== file.filePath) {
            fileCallTargets.add(targetFilePath);
          }
        } else {
          // Fallback: create file-level "calls" edge
          const targetFilePath = resolveCallToFile(calledName, file);
          if (targetFilePath && targetFilePath !== file.filePath) {
            fileCallTargets.add(targetFilePath);
          }
        }
      }
    };

    for (const fn of file.functions) {
      addCallEdges(getEntityNodeId(file.filePath, fn.name), fn.calledFunctions);
    }
    
    for (const cls of file.classes) {
      for (const method of cls.methods) {
        addCallEdges(getEntityNodeId(file.filePath, cls.name), method.calledFunctions);
      }
    }

    // 2.4 File-level "calls" edges for unresolved entity calls
    for (const targetFilePath of fileCallTargets) {
      const edgeId = `edge:calls:${file.filePath}->${targetFilePath}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source: getFileNodeId(file.filePath),
          target: getFileNodeId(targetFilePath),
          type: 'calls',
          label: 'calls'
        });
      }
    }
  }

  // --- Step 3: Importance Scoring ---
  // Calculate in-degree and out-degree for each file
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  
  for (const edge of edges) {
    if (edge.type === 'import' || edge.type === 'calls') {
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
