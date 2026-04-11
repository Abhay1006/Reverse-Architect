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
      type: prop.getType().getText(),
      visibility: 'public', // Interfaces inherently have public visibility
    };
  });

  const methods: ParsedMethod[] = interfaceNode.getMethods().map((method) => {
    const parameters: ParsedParameter[] = method.getParameters().map((param) => ({
      name: param.getName(),
      type: param.getType().getText(),
    }));

    return {
      name: method.getName() || 'AnonymousMethod',
      parameters,
      returnType: method.getReturnType().getText(),
      visibility: 'public', // Interfaces inherently have public visibility
    };
  });

  // Interfaces can extend multiple other interfaces, e.g., `interface A extends B, C`
  const extendsArray = interfaceNode.getExtends().map((ext) => ext.getText());

  return {
    kind: 'interface',
    name,
    isExported,
    properties,
    methods,
    extends: extendsArray,
  };
}
