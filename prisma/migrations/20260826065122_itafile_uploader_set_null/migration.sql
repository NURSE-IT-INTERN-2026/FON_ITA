-- DropForeignKey
ALTER TABLE "ita_files" DROP CONSTRAINT "ita_files_user_id_fkey";

-- AlterTable
ALTER TABLE "ita_files" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ita_files" ADD CONSTRAINT "ita_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
