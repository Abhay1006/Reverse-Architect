import type { ArchNode, PatternMatch } from 'shared';
import { normName } from './names.js';

/**
 * Heuristic check for Singleton pattern.
 * Checks if a class has a 'getInstance' method and an 'instance' property.
 */
export function detectSingleton(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  const properties = node.metadata.properties || [];

  const getInstance = methods.find(m => normName(m) === 'getinstance');
  const instanceProp = properties.find(p => normName(p) === 'instance');
  if (!getInstance) return null;

  const reasons = [`has method "${getInstance}"`];
  if (instanceProp) {
    reasons.push(`has property "${instanceProp}"`);
    return { nodeId: node.id, pattern: 'singleton', confidence: 'high', reasons };
  }
  return { nodeId: node.id, pattern: 'singleton', confidence: 'medium', reasons };
}
