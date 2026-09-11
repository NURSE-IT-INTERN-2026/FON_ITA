import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt from node:crypto — no bcrypt, no auth library (decisions.md D7).
// Async throughout: scryptSync blocks the event loop for tens of milliseconds,
// which stalls every other request on the server under concurrent logins.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * The one password-length floor and ceiling, shared by login (F7), user
 * management (F24), the profile page (F25) and the forced reset (F34). They
 * live here — with the code that hashes passwords — so the schemas cannot
 * drift apart silently. The ceiling matters because scrypt work grows with
 * input length and the login field is unauthenticated; every path that sets a
 * password uses the same pair, so what was accepted at set time can always be
 * typed at login.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** Stored in `User.password` as `saltHex:hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_BYTES);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Constant-time compare against a stored `saltHex:hashHex`.
 * Returns false rather than throwing on malformed input.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!password || !stored) return false;

  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  // Derive to the stored length, not KEY_BYTES, so hashes written under an
  // older parameter still verify if KEY_BYTES is ever changed.
  const actual = await scryptAsync(password, salt, expected.length);

  // timingSafeEqual throws on a length mismatch, so guard it first.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Burn roughly the same time as a real verify when no account was found.
 *
 * Without this, "unknown email" returns noticeably faster than "wrong password",
 * which turns the login form into an account-existence oracle. Call it in the
 * not-found branch of the login action (F7).
 */
export async function fakeVerifyDelay(): Promise<void> {
  await scryptAsync("", randomBytes(SALT_BYTES), KEY_BYTES);
}
