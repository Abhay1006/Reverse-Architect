import { ClassDeclaration, SyntaxKind } from 'ts-morph';
import type { ParsedClass, ParsedProperty, ParsedMethod, ParsedParameter } from '../../../../shared/types.js';
import { calculateComplexity } from '../../analyzers/complexity.js';

/**
 * Extracts relevant metadata from a ts-morph ClassDeclaration.
 * 
 * @param classNode The ts-morph ClassDeclaration node
 * @returns A ParsedClass object representing class structure
 */
export function extractClass(classNode: ClassDeclaration): ParsedClass {
  const name = classNode.getName() || 'AnonymousClass';
  const isExported = classNode.isExported();
  const isAbstract = classNode.isAbstract();

  const properties: ParsedProperty[] = classNode.getProperties().map((prop) => {
    let visibility: ParsedProperty['visibility'] = 'public'; // TS default class members
    if (prop.hasModifier(SyntaxKind.PrivateKeyword)) visibility = 'private';
    else if (prop.hasModifier(SyntaxKind.ProtectedKeyword)) visibility = 'protected';

    return {
      name: prop.getName(),
      type: prop.getTypeNode()?.getText() || prop.getType().getText().replace(/import\([^)]+\)\./g, ''),
      visibility,
    };
  });

  const methods: ParsedMethod[] = classNode.getMethods().map((method) => {
    let visibility: ParsedMethod['visibility'] = 'public'; // TS default class methods
    if (method.hasModifier(SyntaxKind.PrivateKeyword)) visibility = 'private';
    else if (method.hasModifier(SyntaxKind.ProtectedKeyword)) visibility = 'protected';

    const parameters: ParsedParameter[] = method.getParameters().map((param) => ({
      name: param.getName(),
      type: param.getTypeNode()?.getText() || param.getType().getText().replace(/import\([^)]+\)\./g, ''),
    }));

    const calledFunctions = new Set<string>();
    const calls = method.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.Identifier) {
        calledFunctions.add(expr.getText());
      } else if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const parts = expr.getText().split('.');
        calledFunctions.add(parts[parts.length - 1]);
      }
    }

    return {
      name: method.getName() || 'AnonymousMethod',
      parameters,
      returnType: method.getReturnTypeNode()?.getText() || method.getReturnType().getText().replace(/import\([^)]+\)\./g, ''),
      visibility,
      complexity: calculateComplexity(method),
      calledFunctions: Array.from(calledFunctions),
    };
  });

  const extendsClause = classNode.getExtends();
  const extendsObj = extendsClause ? extendsClause.getText() : undefined;

  const implementsObj = classNode.getImplements().map((impl) => impl.getText());

  const decorators = classNode.getDecorators().map((dec) => dec.getName());

  const lineCount = classNode.getEndLineNumber() - classNode.getStartLineNumber() + 1;

  return {
    kind: 'class',
    name,
    isExported,
    isAbstract,
    properties,
    methods,
    extends: extendsObj,
    implements: implementsObj,
    decorators,
    lineCount,
  };
}
