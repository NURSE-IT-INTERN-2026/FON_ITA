import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived Lovable/auth migration material — the port is complete, kept for
    // reference only. See _migration-archive/README.md.
    "_migration-archive/**",
    // Prisma generated client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
