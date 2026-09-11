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

    // Same ceiling as bodySizeLimit below, for a different gate: proxy.ts exists,
    // so Next buffers a copy of every request body capped at its own 10MB default.
    // A 9.9MB upload plus multipart framing crosses that default and arrived at
    // the action truncated — the action never saw the bytes bodySizeLimit allowed
    // through. Keep the two limits in sync.
    proxyClientMaxBodySize: "11mb",

    serverActions: {
      // File uploads go through a Server Action, and the default cap is 1MB —
      // every upload over that fails before the action runs. MAX_FILE_SIZE_BYTES
      // allows 10MB, plus room for multipart boundaries and the other fields.
      // The action still enforces the real limit; this only lets the body reach it.
      bodySizeLimit: "11mb",
    },
  },

  // Defense-in-depth: the reverse proxy in front of this app (IIS on the
  // faculty server, or whatever Dokploy puts in front) may or may not add its
  // own security headers, so the app sets its own rather than depending on it.
  // `script-src`/`style-src` keep 'unsafe-inline' because Next's own hydration
  // payload and Tailwind runtime styles are inline — tightening that to a
  // nonce-based CSP is a separate, riskier change. The real XSS defense here is
  // DOMPurify sanitising OIT content (decisions.md D3), not this header.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No includeSubDomains: HSTS is domain-wide, so it would force HTTPS
          // on every nurse.cmu.ac.th subdomain — not ours to decide.
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-eval' only in dev: React/Fast Refresh calls eval() to
              // reconstruct stack traces across HMR boundaries. Production
              // builds never eval(), so the real deployment stays strict.
              process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "frame-src https://www.youtube-nocookie.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
