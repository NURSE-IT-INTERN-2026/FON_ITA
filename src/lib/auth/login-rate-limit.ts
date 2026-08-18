import { createHash } from "node:crypto";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

declare global {
  var __fonitaLoginRateLimitStore: Map<string, Bucket> | undefined;
}

const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const LOGIN_RATE_LIMIT_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_PER_IP ?? 10);
const LOGIN_RATE_LIMIT_PER_IDENTITY = Number(process.env.LOGIN_RATE_LIMIT_PER_IDENTITY ?? 5);

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

function consume(bucket: string, key: string, limit: number, now: number) {
  const store = getStore();
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
}

function reset(bucket: string, key: string): void {
  getStore().delete(bucketKey(bucket, key));
}

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export async function consumeLoginRateLimit(email: string): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
  ipKey: string;
  identityKey: string;
}> {
  const now = Date.now();
  if (getStore().size > 5_000) prune(now);

  const ipKey = await clientIp();
  const identityKey = `${ipKey}:${email}`;

  const ipResult = consume("login:ip", ipKey, LOGIN_RATE_LIMIT_PER_IP, now);
  const identityResult = consume(
    "login:identity",
    identityKey,
    LOGIN_RATE_LIMIT_PER_IDENTITY,
    now,
  );

  return {
    allowed: ipResult.allowed && identityResult.allowed,
    retryAfterSeconds: Math.max(ipResult.retryAfterSeconds, identityResult.retryAfterSeconds),
    ipKey,
    identityKey,
  };
}

export function resetLoginRateLimit(ipKey: string, identityKey: string): void {
  reset("login:ip", ipKey);
  reset("login:identity", identityKey);
}
