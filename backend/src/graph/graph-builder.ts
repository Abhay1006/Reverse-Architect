import * as path from 'path';
import type { ArchGraph, ArchNode, ArchEdge, ParsedFile } from '../../../shared/types.js';

/**
 * Builds an ArchGraph from an array of ParsedFile objects.
 * Maps files and their internal entities (classes, interfaces, functions) to nodes,
 * and establishes edges based on imports and inheritance.
 * 
 * If entryFile is provided, it builds a dependency tree starting from that file
 * by recursively following import statements (BFS). Only reachable files are included.
 * 
 * @param files Array of parsed file data from the extractor
 * @param entryFile Optional relative path to the entry file to use as the root
 * @returns A complete ArchGraph structure
 */
export function buildGraph(files: ParsedFile[], entryFile?: string): ArchGraph {
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  
  // Quick lookup map for resolution
  const fileMap = new Map<string, ParsedFile>();
  for (const file of files) {
    fileMap.set(file.filePath, file);
  }

  // --- Filter Files by Reachability (BFS) ---
  const reachableFiles = new Set<string>();
  
  if (entryFile && fileMap.has(entryFile)) {
    // Tree mode: Follow imports from entry point
    const queue = [entryFile];
    reachableFiles.add(entryFile);

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const file = fileMap.get(currentPath)!;

      for (const imp of file.imports) {
        if (imp.resolvedPath && fileMap.has(imp.resolvedPath) && !reachableFiles.has(imp.resolvedPath)) {
          reachableFiles.add(imp.resolvedPath);
          queue.push(imp.resolvedPath);
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
  const groupSet = new Set<string>();

  for (const file of files) {
    // Only process reachable files
    if (!reachableFiles.has(file.filePath)) continue;

    const parentDir = path.basename(path.dirname(file.filePath));
    groupSet.add(parentDir);
    const parentNodeId = getGroupNodeId(parentDir);

    // 1.1 Add File Node
    nodes.push({
      id: getFileNodeId(file.filePath),
      label: file.name,
      type: 'file',
      filePath: file.filePath,
      parentNode: parentNodeId,
      metadata: {
        lineCount: file.lineCount || 0,
        exportCount: file.classes.length + file.interfaces.length + file.functions.length,
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
          parentNode: parentNodeId,
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
        parentNode: parentNodeId,
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
        parentNode: parentNodeId,
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
        parentNode: parentNodeId,
        metadata: {
          lineCount: fn.lineCount || 0,
          exportCount: 0,
          maxComplexity: fn.complexity
        },
        position: { x: 0, y: 0 }
      });
    }
  }

  // Generate the actual Group Nodes
  for (const group of groupSet) {
    if (!group || group === '.') continue; // Skip empty/root if anomalies occur
    nodes.push({
      id: getGroupNodeId(group),
      label: group,
      type: 'group',
      filePath: '',
      metadata: { lineCount: 0, exportCount: 0, maxComplexity: 0 },
      position: { x: 0, y: 0 }
    });
  }

  // --- Step 2: Edge Generation ---
  for (const file of files) {
    if (!reachableFiles.has(file.filePath)) continue;

    // 2.1 File-level Import Edges
    for (const imp of file.imports) {
      if (imp.resolvedPath && reachableFiles.has(imp.resolvedPath)) {
        edges.push({
          id: `edge:import:${file.filePath}->${imp.resolvedPath}`,
          source: getFileNodeId(file.filePath),
          target: getFileNodeId(imp.resolvedPath),
          type: 'import',
          label: imp.moduleSpecifier
        });
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
