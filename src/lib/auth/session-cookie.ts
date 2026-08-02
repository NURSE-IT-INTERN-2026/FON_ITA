// Cookie names and attributes, kept apart from session-token.ts so that
// proxy.ts can read the cookie name without pulling `node:crypto` (and the
// whole session/Prisma chain) into the proxy bundle.

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "session";

// Must match `basePath` in next.config.ts, or the cookie is sent to sibling apps
// on the same domain.
export const SESSION_COOKIE_PATH = process.env.SESSION_COOKIE_PATH ?? "/fonita";

export const SESSION_COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE ??
  "lax") as "lax" | "strict" | "none";
