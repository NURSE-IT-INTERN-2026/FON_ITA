import { headers } from "next/headers";
import { getLoginRateLimitProvider } from "@/lib/auth/login-rate-limit-provider";

const LOGIN_RATE_LIMIT_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_PER_IP ?? 10);
const LOGIN_RATE_LIMIT_PER_IDENTITY = Number(process.env.LOGIN_RATE_LIMIT_PER_IDENTITY ?? 5);

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
  const ipKey = await clientIp();
  const identityKey = `${ipKey}:${email}`;
  const provider = getLoginRateLimitProvider();

  const ipResult = provider.consume("login:ip", ipKey, LOGIN_RATE_LIMIT_PER_IP, now);
  const identityResult = provider.consume(
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

/**
 * Successful login should only clear the identity bucket.
 *
 * Clearing the shared IP bucket too would let one successful login refill the
 * budget for every other request coming from the same NAT address, which weakens
 * the per-IP limiter's purpose.
 */
export function resetIdentityLoginRateLimit(identityKey: string): void {
  getLoginRateLimitProvider().reset("login:identity", identityKey);
}
