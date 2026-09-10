/**
 * Seed throwaway users so the user-management list has enough rows to page
 * through (USERS_PER_PAGE = 15 in src/lib/users/queries.ts). Dev database
 * only — never run against production.
 *
 *   npm run db:seed-test-users              create (default 30, override with TEST_USERS_COUNT)
 *   npm run db:seed-test-users -- --clean   delete them again
 *
 * Re-running upserts, so the set stays deterministic. Every account shares one
 * password — they exist to fill pages, not to be secure.
 */
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Standalone tsx run — nothing has loaded the env files yet. Later files win,
// matching Next.js precedence.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const TEST_DOMAIN = "fonita.test";
const DEFAULT_COUNT = 30;
const PASSWORD = "FonitaTest2569!";

const PREFIXES = ["นาย", "นางสาว", "นาง"];
const FIRSTNAMES = [
  "สมชาย", "สมหญิง", "มานะ", "มาลี", "ประยุทธ์", "ปิยะ",
  "วรรณา", "ธนกร", "พิมพ์ชนก", "อนันต์", "จิราภรณ์", "กิตติ",
];
const LASTNAMES = [
  "ใจดี", "รักไทย", "ศรีสุข", "พงษ์สุวรรณ",
  "แสงทอง", "บุญมี", "ทองคำ", "วัฒนชัย",
];

function userFor(i: number) {
  const local = `test.user.${String(i + 1).padStart(2, "0")}`;
  return {
    email: `${local}@${TEST_DOMAIN}`,
    cmuAccount: local,
    prefix: PREFIXES[i % PREFIXES.length],
    firstname: FIRSTNAMES[i % FIRSTNAMES.length],
    lastname: LASTNAMES[i % LASTNAMES.length],
    // Mostly ADMIN, every 5th USER: the new system never creates USER accounts,
    // but the list still has to render legacy-role rows. Every 10th disabled,
    // to exercise the status filter while paging.
    role: i % 5 === 4 ? ("USER" as const) : ("ADMIN" as const),
    status: i % 10 !== 9,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("\n  ✗ ไม่พบ DATABASE_URL\n");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    if (process.argv.includes("--clean")) {
      const { count } = await prisma.user.deleteMany({
        where: { email: { endsWith: `@${TEST_DOMAIN}` } },
      });
      console.log(`\n  ✓ ลบผู้ใช้ทดสอบแล้ว ${count} บัญชี\n`);
      return;
    }

    const count = Math.max(1, Number(process.env.TEST_USERS_COUNT) || DEFAULT_COUNT);
    // One hash shared by every account — re-deriving thirty scrypt digests on
    // every run buys nothing for filler rows.
    const passwordHash = await hashPassword(PASSWORD);

    for (let i = 0; i < count; i++) {
      const data = userFor(i);
      await prisma.user.upsert({
        where: { email: data.email },
        update: { ...data, password: passwordHash },
        create: { ...data, password: passwordHash },
      });
    }

    const total = await prisma.user.count();
    console.log(
      `\n  ✓ สร้าง/อัปเดตผู้ใช้ทดสอบ ${count} บัญชี` +
        `\n    อีเมล: test.user.01–${String(count).padStart(2, "0")}@${TEST_DOMAIN}` +
        `\n    รหัสผ่านทุกบัญชี: ${PASSWORD}` +
        `\n    ตอนนี้ทั้งระบบมีผู้ใช้ ${total} คน — หน้าจัดการผู้ใช้แบ่งหน้าละ 15` +
        `\n    ลบเมื่อทดสอบเสร็จ: npm run db:seed-test-users -- --clean\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
