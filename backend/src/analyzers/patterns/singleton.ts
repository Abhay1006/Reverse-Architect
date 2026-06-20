import type { ArchNode, PatternMatch } from 'shared';

/**
 * Heuristic check for Singleton pattern.
 * Checks if a class has a 'getInstance' method and an 'instance' property.
 */
export function detectSingleton(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  const properties = node.metadata.properties || [];

  const hasGetInstance = methods.some(m => m.toLowerCase() === 'getinstance');
  const hasInstanceProp = properties.some(p => p.toLowerCase() === 'instance');

  if (hasGetInstance && hasInstanceProp) {
    return { nodeId: node.id, pattern: 'singleton', confidence: 'high' };
  } else if (hasGetInstance) {
    return { nodeId: node.id, pattern: 'singleton', confidence: 'medium' };
  }

  return null;
}
