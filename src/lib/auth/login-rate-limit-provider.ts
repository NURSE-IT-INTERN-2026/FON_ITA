import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

export type RateLimitConsumeResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimitProvider = {
  consume: (bucket: string, key: string, limit: number, now: number) => RateLimitConsumeResult;
  reset: (bucket: string, key: string) => void;
};

declare global {
  var __fonitaLoginRateLimitStore: Map<string, Bucket> | undefined;
  var __fonitaLoginRateLimitProvider: RateLimitProvider | undefined;
}

const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const LOGIN_RATE_LIMIT_PROVIDER = process.env.LOGIN_RATE_LIMIT_PROVIDER ?? "memory";

function getStore(): Map<string, Bucket> {
  if (!globalThis.__fonitaLoginRateLimitStore) {
    globalThis.__fonitaLoginRateLimitStore = new Map();
  }
  return globalThis.__fonitaLoginRateLimitStore;
}

function prune(now: number): void {
  const store = getStore();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

function bucketKey(bucket: string, key: string): string {
  const fingerprint = createHash("sha256").update(key).digest("hex");
  return `${bucket}:${fingerprint}`;
}

function createMemoryProvider(): RateLimitProvider {
  return {
    consume(bucket, key, limit, now) {
      const store = getStore();
      if (store.size > 5_000) prune(now);

      const storeKey = bucketKey(bucket, key);
      const current = store.get(storeKey);

      if (!current || current.resetAt <= now) {
        store.set(storeKey, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset(bucket, key) {
      getStore().delete(bucketKey(bucket, key));
    },
  };
}

/**
 * Provider registry for future shared-store implementations.
 *
 * Today only `memory` exists. A future Redis/DB-backed provider should plug in
 * here and keep the rest of the login flow unchanged.
 */
export function getLoginRateLimitProvider(): RateLimitProvider {
  if (!globalThis.__fonitaLoginRateLimitProvider) {
    if (LOGIN_RATE_LIMIT_PROVIDER !== "memory") {
      throw new Error(
        `Unsupported LOGIN_RATE_LIMIT_PROVIDER \"${LOGIN_RATE_LIMIT_PROVIDER}\". ` +
          'Only "memory" is implemented today.',
      );
    }

    globalThis.__fonitaLoginRateLimitProvider = createMemoryProvider();
  }

  return globalThis.__fonitaLoginRateLimitProvider;
}
