import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Next.js loads .env.local on its own, but the Prisma CLI does not, and Prisma 7
// dropped the implicit .env lookup in config files. Node's built-in loader covers
// it without pulling in dotenv. Later files win, matching Next.js precedence.
for (const file of ['.env', '.env.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
