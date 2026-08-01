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
};

export default nextConfig;
