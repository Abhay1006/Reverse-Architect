import type { ArchNode, PatternMatch } from 'shared';
import { hasWordPrefix } from './names.js';

/** Prefixes of the chained configuration steps a builder exposes. */
const STEP_PREFIXES = ['with', 'set', 'add'];

/**
 * Heuristic check for Builder pattern.
 * A builder accumulates configuration through several step methods
 * (`withX`, `setX`, `addX`) and produces the result from a `build` method.
 */
export function detectBuilder(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  const buildMethod = methods.find(m => m.toLowerCase() === 'build');
  // Require a following word so `settle` or `address` don't count.
  const steps = methods.filter(m => STEP_PREFIXES.some(p => hasWordPrefix(m, p)));
  const isNamedBuilder = /builder$/i.test(node.label);

  const reasons: string[] = [];
  if (buildMethod) reasons.push(`has method "${buildMethod}"`);
  reasons.push(...steps.slice(0, 4).map(m => `has step method "${m}"`));
  if (isNamedBuilder) reasons.push(`class name "${node.label}" ends in "Builder"`);

  if (buildMethod && (steps.length >= 2 || isNamedBuilder)) {
    return { nodeId: node.id, pattern: 'builder', confidence: 'high', reasons };
  } else if (buildMethod && steps.length === 1) {
    return { nodeId: node.id, pattern: 'builder', confidence: 'medium', reasons };
  } else if (isNamedBuilder) {
    return { nodeId: node.id, pattern: 'builder', confidence: 'low', reasons };
  }

  return null;
}
