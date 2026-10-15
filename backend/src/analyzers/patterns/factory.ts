import type { ArchNode, PatternMatch } from 'shared';

const FACTORY_PREFIXES = ['create', 'make'];

/**
 * Heuristic check for Factory pattern.
 * Checks if a class has methods starting with 'create' or 'make'.
 * `build*` methods belong to the builder detector.
 */
export function detectFactory(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  // Match on the prefix only, so 'createNode' counts and 'recreate' does not.
  const factoryMethods = (node.metadata.methods || []).filter(m =>
    FACTORY_PREFIXES.some(prefix => m.toLowerCase().startsWith(prefix)),
  );
  const isNamedFactory = /factory$/i.test(node.label);

  const reasons = factoryMethods.slice(0, 5).map(m => `has creation method "${m}"`);
  if (isNamedFactory) reasons.push(`class name "${node.label}" ends in "Factory"`);

  if (factoryMethods.length > 0 && isNamedFactory) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'high', reasons };
  } else if (factoryMethods.length >= 2) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'medium', reasons };
  } else if (isNamedFactory) {
    return { nodeId: node.id, pattern: 'factory', confidence: 'low', reasons };
  }

  return null;
}
