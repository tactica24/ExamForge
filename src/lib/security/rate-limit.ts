import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin-app";

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

function toRateLimitResult(args: { input: RateLimitInput; record: RateLimitRecord; now: number }): RateLimitResult {
  const retryAfterSec = Math.max(1, Math.ceil((args.record.resetAt - args.now) / 1000));
  const remaining = Math.max(0, args.input.max - args.record.count);

  return {
    ok: args.record.count <= args.input.max,
    limit: args.input.max,
    remaining,
    retryAfterSec
  };
}

function takeRateLimitInMemory(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneStore(now, store);

  const existing = store.get(input.key);
  const inWindow = existing && existing.resetAt > now;

  const record: RateLimitRecord = inWindow
    ? { count: existing.count + 1, resetAt: existing.resetAt }
    : { count: 1, resetAt: now + input.windowMs };

  store.set(input.key, record);
  return toRateLimitResult({ input, record, now });
}

async function takeRateLimitWithFirestore(input: RateLimitInput): Promise<RateLimitResult | null> {
  const db = getFirebaseAdminDb();
  if (!db) return null;

  const now = Date.now();
  const docRef = db.collection("rate_limits").doc(input.key);
  let record: RateLimitRecord | null = null;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const raw = snap.exists ? (snap.data() as Record<string, unknown>) : null;
      const prevCount = Number(raw?.count ?? 0);
      const prevResetAt = Number(raw?.resetAt ?? 0);
      const inWindow = Number.isFinite(prevResetAt) && prevResetAt > now;

      record = inWindow
        ? { count: Math.max(0, prevCount) + 1, resetAt: prevResetAt }
        : { count: 1, resetAt: now + input.windowMs };

      tx.set(
        docRef,
        {
          count: record.count,
          resetAt: record.resetAt,
          updated_at: new Date(now).toISOString()
        },
        { merge: true }
      );
    });
  } catch {
    return null;
  }

  if (!record) return null;
  return toRateLimitResult({ input, record, now });
}

export async function takeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const distributed = await takeRateLimitWithFirestore(input);
  if (distributed) return distributed;
  return takeRateLimitInMemory(input);
}

