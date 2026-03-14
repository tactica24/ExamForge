import "server-only";

import { executeAuroraStatement, isAuroraDataConfigured } from "@/lib/aws/rds-data";

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

async function takeRateLimitWithAurora(input: RateLimitInput): Promise<RateLimitResult | null> {
  if (!isAuroraDataConfigured()) return null;

  const now = Date.now();
  const nextResetAt = now + input.windowMs;
  const updatedAt = new Date(now).toISOString();

  try {
    const result = await executeAuroraStatement({
      sql: `
        INSERT INTO "rate_limits" AS rl ("key", "count", "reset_at", "updated_at")
        VALUES (:key, 1, :next_reset_at, :updated_at)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN rl."reset_at" > :now_ms THEN rl."count" + 1 ELSE 1 END,
          "reset_at" = CASE WHEN rl."reset_at" > :now_ms THEN rl."reset_at" ELSE :next_reset_at END,
          "updated_at" = :updated_at
        RETURNING "count", "reset_at"
      `,
      parameters: [
        { name: "key", value: input.key },
        { name: "next_reset_at", value: nextResetAt },
        { name: "updated_at", value: updatedAt },
        { name: "now_ms", value: now }
      ]
    });

    const row = (result.rows[0] ?? {}) as Record<string, unknown>;
    const record: RateLimitRecord = {
      count: Number(row.count ?? 0),
      resetAt: Number(row.reset_at ?? nextResetAt)
    };
    return toRateLimitResult({ input, record, now });
  } catch {
    return null;
  }
}

export async function takeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const distributed = await takeRateLimitWithAurora(input);
  if (distributed) return distributed;
  return takeRateLimitInMemory(input);
}
