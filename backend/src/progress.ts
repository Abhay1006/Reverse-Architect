import { EventEmitter } from 'events';

export type ProgressStep = 'cloning' | 'starting-lsp' | 'extracting' | 'building-graph' | 'done' | 'error';

export interface ProgressEvent {
  step: ProgressStep;
  message: string;
  progress?: number; // 0-100 for 'extracting'
}

export type ProgressListener = (event: ProgressEvent) => void;

/** Sessions with no activity for this long are dropped. */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** How often abandoned sessions are swept. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Hard cap so an unauthenticated client cannot grow the map without bound. */
const MAX_SESSIONS = 500;

interface SessionState {
  event: ProgressEvent;
  updatedAt: number;
}

class ProgressTracker extends EventEmitter {
  private sessions = new Map<string, SessionState>();

  constructor() {
    super();
    // A client can open a progress stream and never start an analysis, so
    // entries expire on their own rather than only on route completion.
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    timer.unref();
  }

  emitProgress(sessionId: string, event: ProgressEvent) {
    if (this.sessions.size >= MAX_SESSIONS && !this.sessions.has(sessionId)) {
      this.evictOldest();
    }
    this.sessions.set(sessionId, { event, updatedAt: Date.now() });
    this.emit(`progress:${sessionId}`, event);
  }

  getLastEvent(sessionId: string): ProgressEvent | undefined {
    return this.sessions.get(sessionId)?.event;
  }

  subscribe(sessionId: string, listener: ProgressListener) {
    this.on(`progress:${sessionId}`, listener);
  }

  unsubscribe(sessionId: string, listener: ProgressListener) {
    this.off(`progress:${sessionId}`, listener);
  }

  cleanup(sessionId: string) {
    this.sessions.delete(sessionId);
    this.removeAllListeners(`progress:${sessionId}`);
  }

  /** Drop sessions that have gone quiet, along with any dangling listeners. */
  private sweep() {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [sessionId, state] of this.sessions) {
      if (state.updatedAt < cutoff) {
        this.cleanup(sessionId);
      }
    }
  }

  private evictOldest() {
    let oldestId: string | null = null;
    let oldestAt = Infinity;
    for (const [sessionId, state] of this.sessions) {
      if (state.updatedAt < oldestAt) {
        oldestAt = state.updatedAt;
        oldestId = sessionId;
      }
    }
    if (oldestId) this.cleanup(oldestId);
  }
}

export const progressTracker = new ProgressTracker();
