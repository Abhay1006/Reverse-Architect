import { EventEmitter } from 'events';

export type ProgressStep = 'cloning' | 'starting-lsp' | 'extracting' | 'building-graph' | 'done' | 'error';

export interface ProgressEvent {
  step: ProgressStep;
  message: string;
  progress?: number; // 0-100 for 'extracting'
}

class ProgressTracker extends EventEmitter {
  private sessions = new Map<string, ProgressEvent>();

  emitProgress(sessionId: string, event: ProgressEvent) {
    this.sessions.set(sessionId, event);
    this.emit(`progress:${sessionId}`, event);
  }

  getLastEvent(sessionId: string): ProgressEvent | undefined {
    return this.sessions.get(sessionId);
  }

  cleanup(sessionId: string) {
    this.sessions.delete(sessionId);
    this.removeAllListeners(`progress:${sessionId}`);
  }
}

export const progressTracker = new ProgressTracker();
