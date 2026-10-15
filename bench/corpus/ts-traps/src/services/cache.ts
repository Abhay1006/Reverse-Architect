// Calls a *method* named cleanup on its own store. It has nothing to do with
// logger.ts's cleanup() function, but a name-based call resolver can't tell.
export class Cache {
  private store = new Map<string, number>() as Map<string, number> & { cleanup?: () => void };

  put(key: string): void {
    this.store.set(key, Date.now());
  }

  clear(): void {
    this.store.cleanup?.();
    this.store.clear();
  }
}
