type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  windowMs: number;
  max: number;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

const RATE_LIMIT_STATE_KEY = "__aceNaijaRateLimitState";
const MAX_TRACKED_KEYS = 10_000;

function getStore() {
  const globalRef = globalThis as typeof globalThis & {
    [RATE_LIMIT_STATE_KEY]?: Map<string, RateLimitRecord>;
  };
  if (!globalRef[RATE_LIMIT_STATE_KEY]) {
    globalRef[RATE_LIMIT_STATE_KEY] = new Map<string, RateLimitRecord>();
  }
  return globalRef[RATE_LIMIT_STATE_KEY]!;
}

function pruneStore(now: number, store: Map<string, RateLimitRecord>) {
  for (const [key, value] of store) {
    if (value.resetAt <= now) store.delete(key);
  }

  if (store.size <= MAX_TRACKED_KEYS) return;

  const overflow = store.size - MAX_TRACKED_KEYS;
  const iterator = store.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = iterator.next();
    if (next.done) break;
    store.delete(next.value);
  }
}

export function takeRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneStore(now, store);

  const existing = store.get(input.key);
  const inWindow = existing && existing.resetAt > now;

  const record: RateLimitRecord = inWindow
    ? { count: existing.count + 1, resetAt: existing.resetAt }
    : { count: 1, resetAt: now + input.windowMs };

  store.set(input.key, record);

  const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  const remaining = Math.max(0, input.max - record.count);

  return {
    ok: record.count <= input.max,
    limit: input.max,
    remaining,
    retryAfterSec
  };
}
