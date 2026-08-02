import { withBasePath } from "@/lib/base-path";

// Kept apart from storage.ts, which imports node:fs and so can never be pulled
// into a Client Component. The file picker (F21) needs this on the client.

/**
 * Public URL of a stored file, served by the route handler in F22.
 *
 * `storedName` is our generated name (timestamp + extension), not anything the
 * user typed — but it is still encoded, so the URL cannot be broken by a name
 * that ever changes shape.
 */
export function fileUrl(storedName: string): string {
  return withBasePath(`/storage/itafile/${encodeURIComponent(storedName)}`);
}
