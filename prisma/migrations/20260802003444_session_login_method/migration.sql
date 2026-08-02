-- CreateEnum
CREATE TYPE "LoginMethod" AS ENUM ('PASSWORD', 'CMU_OAUTH');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "login_method" "LoginMethod" NOT NULL DEFAULT 'PASSWORD';
