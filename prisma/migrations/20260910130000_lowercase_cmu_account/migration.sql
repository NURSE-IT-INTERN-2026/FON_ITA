-- The OAuth callback used to look this column up case-insensitively (ILIKE),
-- which let `_`/`%` in a CMU account name act as SQL wildcards. Switching that
-- lookup to an exact match (see the code change alongside this migration)
-- means any row that isn't already lowercase would stop matching its real CMU
-- account. One-time, idempotent backfill — a no-op on a database where every
-- row is already lowercase.
UPDATE "users" SET "cmu_account" = LOWER("cmu_account") WHERE "cmu_account" <> LOWER("cmu_account");
