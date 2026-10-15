import type { ArchNode, PatternMatch } from 'shared';
import { normName } from './names.js';

/** Exact method names that register or remove a listener. */
const SUBSCRIBE_NAMES = new Set([
  'subscribe', 'unsubscribe', 'on', 'once', 'off',
  'addlistener', 'removelistener', 'addeventlistener', 'removeeventlistener',
  'addobserver', 'removeobserver', 'attach', 'detach', 'register', 'unregister',
]);

/** Prefixes of methods that fan an event out to listeners. */
const NOTIFY_PREFIXES = ['notify', 'emit', 'publish', 'dispatch', 'trigger', 'fire'];

/**
 * Heuristic check for Observer pattern.
 * Checks if a class has subscription methods (subscribe, addListener, on)
 * AND notification methods (notify, emit, publish, trigger).
 *
 * Subscription names are matched exactly: a substring match on "on" used to
 * flag every class with a `constructor` or `toJSON`.
 */
export function detectObserver(node: ArchNode): PatternMatch | null {
  if (node.type !== 'class' || !node.metadata) return null;

  const methods = node.metadata.methods || [];
  const sub = methods.filter(m => SUBSCRIBE_NAMES.has(normName(m)));
  const notif = methods.filter(m => NOTIFY_PREFIXES.some(p => normName(m).startsWith(p)));

  const reasons = [
    ...sub.slice(0, 3).map(m => `has subscription method "${m}"`),
    ...notif.slice(0, 3).map(m => `has notification method "${m}"`),
  ];

  if (sub.length > 0 && notif.length > 0) {
    return { nodeId: node.id, pattern: 'observer', confidence: 'high', reasons };
  } else if (sub.length > 0 || notif.length > 0) {
    // Only one half of the pattern: could just be an ordinary event handler.
    return { nodeId: node.id, pattern: 'observer', confidence: 'low', reasons };
  }

  return null;
}
