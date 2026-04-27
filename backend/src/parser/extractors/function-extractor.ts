import { FunctionDeclaration, VariableDeclaration, ArrowFunction, SyntaxKind } from 'ts-morph';
import type { ParsedFunction, ParsedParameter } from '../../../../shared/types.js';
import { calculateComplexity } from '../../analyzers/complexity.js';

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

  const lineCount = functionNode.getEndLineNumber() - functionNode.getStartLineNumber() + 1;
  const complexity = calculateComplexity(functionNode);

  return {
    kind: 'function',
    name,
    isExported,
    parameters,
    returnType: functionNode.getReturnTypeNode()?.getText() || functionNode.getReturnType().getText().replace(/import\([^)]+\)\./g, ''),
    lineCount,
    complexity,
  };
}

/**
 * Extracts metadata from an ArrowFunction assigned to a VariableDeclaration.
 */
export function extractArrowFunction(varDecl: VariableDeclaration, arrowFunc: ArrowFunction): ParsedFunction {
  const name = varDecl.getName();
  const isExported = varDecl.isExported();

  const parameters: ParsedParameter[] = arrowFunc.getParameters().map((param) => ({
    name: param.getName(),
    type: param.getTypeNode()?.getText() || param.getType().getText().replace(/import\([^)]+\)\./g, ''),
  }));

  const lineCount = arrowFunc.getEndLineNumber() - arrowFunc.getStartLineNumber() + 1;
  const complexity = calculateComplexity(arrowFunc);

  return {
    kind: 'function',
    name,
    isExported,
    parameters,
    returnType: arrowFunc.getReturnTypeNode()?.getText() || arrowFunc.getReturnType().getText().replace(/import\([^)]+\)\./g, ''),
    lineCount,
    complexity,
  };
}
