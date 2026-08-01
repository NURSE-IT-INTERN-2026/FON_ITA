import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is mounted under /fonita on the faculty domain
  // (https://service.nurse.cmu.ac.th/fonita). assetPrefix follows basePath
  // automatically for same-origin, so it is not set separately.
  //
  // Public API consumers call WITH the basePath — /fonita/api/v1/ita/{year} —
  // so no `rewrites` are needed. See docs/chapters/05-public-api.md.
  basePath: '/fonita',
  reactCompiler: true,
};

export default nextConfig;
