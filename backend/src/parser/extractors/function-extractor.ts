import { FunctionDeclaration } from 'ts-morph';
import type { ParsedFunction, ParsedParameter } from '../../../../shared/types.js';

/**
 * Extracts relevant metadata from a ts-morph FunctionDeclaration.
 * 
 * @param functionNode The ts-morph FunctionDeclaration node
 * @returns A ParsedFunction object representing function structure
 */
export function extractFunction(functionNode: FunctionDeclaration): ParsedFunction {
  const name = functionNode.getName() || 'AnonymousFunction';
  const isExported = functionNode.isExported();

  const parameters: ParsedParameter[] = functionNode.getParameters().map((param) => ({
    name: param.getName(),
    type: param.getTypeNode()?.getText() || param.getType().getText().replace(/import\([^)]+\)\./g, ''),
  }));

  return {
    kind: 'function',
    name,
    isExported,
    parameters,
    returnType: functionNode.getReturnTypeNode()?.getText() || functionNode.getReturnType().getText().replace(/import\([^)]+\)\./g, ''),
  };
}
