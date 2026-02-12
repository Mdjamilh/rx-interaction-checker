/**
 * Polite fetching for public APIs: at most a few requests at once, a retry
 * with backoff when told to slow down (429) or on a brief outage (503), and
 * an in-memory cache so checking the same list twice costs nothing.
 */
const MAX_CONCURRENT = 4;
const RETRIES = 2;

let active = 0;
const waiting: (() => void)[] = [];

async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await work();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

/** fetch with concurrency limiting and retries; honours Retry-After when given. */
export async function politeFetch(url: string, signal?: AbortSignal, baseDelayMs = 500): Promise<Response> {
  return slot(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { signal });
      if ((res.status !== 429 && res.status !== 503) || attempt >= RETRIES) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt, signal);
    }
  });
}

const cache = new Map<string, Promise<unknown>>();

/**
 * Remembers successful results by key for the session. Failed lookups are
 * forgotten so the next attempt tries again.
 */
export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const promise = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

export function clearCache() {
  cache.clear();
}
