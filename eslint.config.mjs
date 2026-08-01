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
    // Staging area for the Lovable/auth port — not part of the app yet.
    // See docs/migration/file-manifest.md; delete once everything is moved.
    "_migration/**",
    // Prisma generated client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
