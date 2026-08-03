// Suggests a password for the "เพิ่มผู้ใช้" dialog (F24).
//
// Client-side on purpose. Generating it on the server would mean the raw
// password travelling back in a Server Action response so the dialog could
// display it — one more place it exists for no benefit. Here it is created in
// the browser that will show it and posted exactly like a typed one; the server
// still hashes it with scrypt and never learns it was suggested.
//
// This is a convenience, not the security boundary: `src/lib/auth/password.ts`
// is where passwords are actually hashed and verified.

/** No 0/O or 1/l/I — these get read aloud and typed by hand. */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const SYMBOLS = "@#$%&*+-=";
const ALPHABET = LETTERS + SYMBOLS;

/**
 * A 14-character password from `crypto.getRandomValues`.
 *
 * Longer than the 8-character minimum the schema enforces, because this one is
 * meant to be handed over once and then replaced by the user in หน้าโปรไฟล์ —
 * length is the only thing protecting it while it sits in someone's chat window.
 */
export function generatePassword(length = 14): string {
  const alphabet = ALPHABET.length;
  // Reject the tail that would make low indexes more likely. The bias would be
  // about one part in 66 million, but rejecting costs a loop.
  const limit = Math.floor(0xffffffff / alphabet) * alphabet;

  let out = "";
  const buffer = new Uint32Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buffer);
    if (buffer[0] >= limit) continue;
    out += ALPHABET[buffer[0] % alphabet];
  }
  return out;
}
