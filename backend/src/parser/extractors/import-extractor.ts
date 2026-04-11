import { ImportDeclaration } from 'ts-morph';
import type { ParsedImport } from '../../../../shared/types.js';

/**
 * Extracts relevant metadata from a ts-morph ImportDeclaration.
 * 
 * @param importNode The ts-morph ImportDeclaration node
 * @returns A ParsedImport object representing the import details
 */
export function extractImport(importNode: ImportDeclaration): ParsedImport {
  const moduleSpecifier = importNode.getModuleSpecifierValue();
  
  // ts-morph automatically attempts to resolve the module based on tsconfig!
  const resolvedSourceFile = importNode.getModuleSpecifierSourceFile();
  const resolvedPath = resolvedSourceFile ? resolvedSourceFile.getFilePath() : undefined;

  const defaultImport = importNode.getDefaultImport()?.getText();
  const namespaceImport = importNode.getNamespaceImport()?.getText();
  const namedImports = importNode.getNamedImports().map(ni => ni.getName());

  return {
    kind: 'import',
    moduleSpecifier,
    resolvedPath,
    defaultImport,
    namedImports,
    namespaceImport,
  };
}
