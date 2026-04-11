import { ClassDeclaration, SyntaxKind } from 'ts-morph';
import type { ParsedClass, ParsedProperty, ParsedMethod, ParsedParameter } from '../../../../shared/types.js';

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
      type: prop.getType().getText(),
      visibility,
    };
  });

  const methods: ParsedMethod[] = classNode.getMethods().map((method) => {
    let visibility: ParsedMethod['visibility'] = 'public'; // TS default class methods
    if (method.hasModifier(SyntaxKind.PrivateKeyword)) visibility = 'private';
    else if (method.hasModifier(SyntaxKind.ProtectedKeyword)) visibility = 'protected';

    const parameters: ParsedParameter[] = method.getParameters().map((param) => ({
      name: param.getName(),
      type: param.getType().getText(),
    }));

    return {
      name: method.getName() || 'AnonymousMethod',
      parameters,
      returnType: method.getReturnType().getText(),
      visibility,
    };
  });

  const extendsClause = classNode.getExtends();
  const extendsObj = extendsClause ? extendsClause.getText() : undefined;

  const implementsObj = classNode.getImplements().map((impl) => impl.getText());

  const decorators = classNode.getDecorators().map((dec) => dec.getName());

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
  };
}
