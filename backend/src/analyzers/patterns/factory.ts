import type { ArchNode, PatternMatch } from '../../../../shared/types.js';

/**
 * Heuristic check for Factory pattern.
 * Checks if a class has methods starting with 'create', 'make', or 'build'.
 */
export function detectFactory(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  
  const factoryPrefixes = ['create', 'make', 'build'];
  
  // Note: we want to match exact prefix, e.g., 'createNode', 'makeUser' 
  // and not just contain the word like 'recreate'
  let factoryMethodsCount = 0;
  
  for (const method of methods) {
    const lower = method.toLowerCase();
    if (factoryPrefixes.some(prefix => lower.startsWith(prefix))) {
      factoryMethodsCount++;
    }
  }

  // A class named "*Factory" or "*Builder" boosts confidence
  const isNamedFactory = node.label.toLowerCase().includes('factory') || node.label.toLowerCase().includes('builder');

  if (factoryMethodsCount > 0 && isNamedFactory) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'high' };
  } else if (factoryMethodsCount >= 2) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'medium' };
  } else if (isNamedFactory) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'low' };
  }

  return null;
}
