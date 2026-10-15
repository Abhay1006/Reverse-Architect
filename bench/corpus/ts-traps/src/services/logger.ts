import { Cache } from './cache';

const cache = new Cache();

export function log(message: string): void {
  cache.put(message);
  console.log(message);
}

export function cleanup(): void {
  cache.clear();
}
