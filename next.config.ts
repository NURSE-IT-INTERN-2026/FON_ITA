import type { NextConfig } from "next";

const basePath = "/fonita";

const nextConfig: NextConfig = {
  // Mirrored so client components can build raw URLs (plain <a>, fetch) without
  // a second hardcoded copy that could drift. See src/lib/base-path.ts.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },

  // The app is mounted under /fonita on the faculty domain
  // (https://service.nurse.cmu.ac.th/fonita). assetPrefix follows basePath
  // automatically for same-origin, so it is not set separately.
  //
  // Public API consumers call WITH the basePath — /fonita/api/v1/ita/{year} —
  // so no `rewrites` are needed. See docs/chapters/05-public-api.md.
  basePath,
  reactCompiler: true,

  // Dev-only: testing from a phone on the LAN (e.g. http://10.125.66.90:3000)
  // sends a non-localhost Origin, which Next blocks by default — every JS
  // chunk and HMR gets 403, so pages render without hydration (the home page's
  // ITA list, fetched client-side, never appears). Production builds ignore
  // this option entirely. Add the Mac's current Wi-Fi IP here when it changes.
  allowedDevOrigins: ["10.125.66.90"],

  experimental: {
    // Required for unauthorized() / forbidden() from next/navigation, which render
    // src/app/unauthorized.tsx (401) and src/app/forbidden.tsx (403). Still flagged
    // experimental by Next.js 16 — without this they throw instead of rendering.
    authInterrupts: true,

    serverActions: {
      // File uploads go through a Server Action, and the default cap is 1MB —
      // every upload over that fails before the action runs. MAX_FILE_SIZE_BYTES
      // allows 10MB, plus room for multipart boundaries and the other fields.
      // The action still enforces the real limit; this only lets the body reach it.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
