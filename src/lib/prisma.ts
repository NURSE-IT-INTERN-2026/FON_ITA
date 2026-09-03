import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// Prisma 7 requires a driver adapter for a direct database connection — the
// connection string lives only here and in prisma.config.ts, never in the schema.
// The singleton keeps `next dev` from opening a new pool on every hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Escape the LIKE wildcards in a search term before passing it to Prisma's
 * `contains` (which builds an ILIKE pattern and passes the term through as-is —
 * verified: a raw "%" matched every row, and "_" any single character). Not an
 * injection (the value stays parameterised), but a literal "ITA-100%" would be
 * unsearchable. PostgreSQL's default escape character is a backslash, which
 * must itself be escaped first.
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
