// ============================================================
//  Atlas — Analysis Concurrency Control
//  Each analysis spawns a language server and opens up to MAX_FILES
//  documents into it. Running several at once will exhaust memory on
//  small hosts, so analyses are serialized and de-duplicated.
// ============================================================

/** Maximum analyses allowed to run at the same time. */
const MAX_CONCURRENT_ANALYSES = parseInt(process.env.ATLAS_MAX_CONCURRENT_ANALYSES ?? '1', 10);

/** How long a caller will wait for a slot before giving up. */
const QUEUE_TIMEOUT_MS = parseInt(process.env.ATLAS_QUEUE_TIMEOUT_MS ?? String(10 * 60 * 1000), 10);

let active = 0;
const waiters: Array<() => void> = [];

/** In-flight analyses keyed by repo id, so duplicate requests share one run. */
const inFlight = new Map<string, Promise<unknown>>();

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_ANALYSES) {
    active++;
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waiters.indexOf(grant);
      if (idx !== -1) waiters.splice(idx, 1);
      reject(new Error('Server is busy analyzing other repositories. Please try again shortly.'));
    }, QUEUE_TIMEOUT_MS);

    const grant = () => {
      clearTimeout(timer);
      active++;
      resolve();
    };

    waiters.push(grant);
  });
}

function release(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Run `task` under the global analysis concurrency limit.
 */
async function withAnalysisSlot<T>(task: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
}

/**
 * Run `task` under the concurrency limit, collapsing concurrent calls for the
 * same `key` into a single execution.
 *
 * Without this, two simultaneous requests for the same repo clone into the same
 * directory and the second one's cleanup deletes the first one's working tree
 * mid-analysis.
 */
export function withRepoLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const run = withAnalysisSlot(task).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, run);
  return run;
}

/** Number of analyses currently running — exposed for the health endpoint. */
export function activeAnalyses(): number {
  return active;
}

/** Number of requests waiting for a slot — exposed for the health endpoint. */
export function queuedAnalyses(): number {
  return waiters.length;
}

/**
 * True while an analysis (or re-clone) holds the lock for `key`. The clone
 * reaper uses this so it never deletes a workspace that is being written.
 */
export function isInFlight(key: string): boolean {
  return inFlight.has(key);
}
