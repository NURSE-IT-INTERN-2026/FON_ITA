// Single source: next.config.ts sets `basePath` and mirrors it into this env var,
// so the two can never drift apart.
//
// Needed only where Next.js does NOT add the basePath itself — plain <a href>,
// fetch(), cookie paths. <Link>, router.push(), redirect() and next/image all
// prepend it automatically, so do not use this there.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
