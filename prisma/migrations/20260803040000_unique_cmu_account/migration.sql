-- `cmu_account` is what the CMU OAuth callback looks a user up by. Two rows
-- sharing a value made the lookup pick between them arbitrarily — including
-- rows with different roles. `email` being unique did not prevent it, because
-- two different emails can share the part before the @.

-- DropIndex
DROP INDEX "users_cmu_account_idx";

-- CreateIndex
CREATE UNIQUE INDEX "users_cmu_account_key" ON "users"("cmu_account");
