import type { ArchNode, PatternMatch } from 'shared';

/**
 * Heuristic check for Observer pattern.
 * Checks if a class has subscription methods (subscribe, addListener, on)
 * AND notification methods (notify, emit, publish, trigger).
 */
export function detectObserver(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  
  const subKeywords = ['subscribe', 'addlistener', 'on', 'register'];
  const notifKeywords = ['notify', 'emit', 'publish', 'trigger', 'dispatch'];
  
  const hasSub = methods.some(m => subKeywords.some(k => m.toLowerCase().includes(k)));
  const hasNotif = methods.some(m => notifKeywords.some(k => m.toLowerCase().includes(k)));

  if (hasSub && hasNotif) {
    return { nodeId: node.id, pattern: 'observer', confidence: 'high' };
  } else if (hasSub || hasNotif) {
    // If it only has one part, it could just be a regular event handler name, low confidence
    return { nodeId: node.id, pattern: 'observer', confidence: 'low' };
  }

  return null;
}
