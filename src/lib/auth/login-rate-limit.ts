import { headers } from "next/headers";
import { getLoginRateLimitProvider } from "@/lib/auth/login-rate-limit-provider";

const LOGIN_RATE_LIMIT_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_PER_IP ?? 10);
const LOGIN_RATE_LIMIT_PER_IDENTITY = Number(process.env.LOGIN_RATE_LIMIT_PER_IDENTITY ?? 5);

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  // `x-real-ip` is what nginx sets from its own view of the connection
  // (`$remote_addr`) — a client cannot rewrite the hop that actually reached
  // the proxy. `x-forwarded-for`'s right-most entry is the same trustworthy
  // value seen from the proxy's side; every entry to its left is whatever the
  // client chose to send, which is why reading the left-most one (the old
  // code) let a forged header value skip the limiter's bucket on every
  // attempt.
  const forwarded = headerStore.get("x-forwarded-for");
  const forwardedLastHop = forwarded
    ?.split(",")
    .pop()
    ?.trim();
  return (
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    forwardedLastHop ||
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
  // Email alone, not `${ipKey}:${email}` — keying on both let a different
  // forged (or genuinely different, behind a shared NAT) IP on every attempt
  // open a fresh identity bucket for the same account, defeating the per-account
  // limit entirely.
  const identityKey = email;
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
