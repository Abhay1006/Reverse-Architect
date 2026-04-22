import { InterfaceDeclaration } from 'ts-morph';
import type { ParsedInterface, ParsedProperty, ParsedMethod, ParsedParameter } from '../../../../shared/types.js';

/**
 * Extracts relevant metadata from a ts-morph InterfaceDeclaration.
 * 
 * @param interfaceNode The ts-morph InterfaceDeclaration node
 * @returns A ParsedInterface object representing interface structure
 */
export function extractInterface(interfaceNode: InterfaceDeclaration): ParsedInterface {
  const name = interfaceNode.getName() || 'AnonymousInterface';
  const isExported = interfaceNode.isExported();

  const properties: ParsedProperty[] = interfaceNode.getProperties().map((prop) => {
    return {
      name: prop.getName(),
      type: prop.getTypeNode()?.getText() || prop.getType().getText().replace(/import\([^)]+\)\./g, ''),
      visibility: 'public', // Interfaces inherently have public visibility
    };
  });

  const methods: ParsedMethod[] = interfaceNode.getMethods().map((method) => {
    const parameters: ParsedParameter[] = method.getParameters().map((param) => ({
      name: param.getName(),
      type: param.getTypeNode()?.getText() || param.getType().getText().replace(/import\([^)]+\)\./g, ''),
    }));

    return {
      name: method.getName() || 'AnonymousMethod',
      parameters,
      returnType: method.getReturnTypeNode()?.getText() || method.getReturnType().getText().replace(/import\([^)]+\)\./g, ''),
      visibility: 'public', // Interfaces inherently have public visibility
    };
  });

  // Interfaces can extend multiple other interfaces, e.g., `interface A extends B, C`
  const extendsArray = interfaceNode.getExtends().map((ext) => ext.getText());

  const lineCount = interfaceNode.getEndLineNumber() - interfaceNode.getStartLineNumber() + 1;

  return {
    kind: 'interface',
    name,
    isExported,
    properties,
    methods,
    extends: extendsArray,
    lineCount,
  };
}
