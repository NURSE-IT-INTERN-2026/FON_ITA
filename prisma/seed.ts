/**
 * Bootstrap the first SUPERADMIN.
 *
 * Without this the system deadlocks: OAuth never auto-provisions (decisions.md D6)
 * and only a SUPERADMIN may create users (D4), so an empty `users` table means
 * nobody can ever sign in. See decisions.md B1.
 *
 *   npm run db:seed
 *
 * Idempotent, and it will not silently reset the password of an account that
 * already exists — pass BOOTSTRAP_ADMIN_FORCE=1 for that.
 */
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// This runs standalone via tsx, not through the Prisma CLI, so nothing has
// loaded the env files yet. Later files win, matching Next.js precedence.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Lowercased: Postgres compares text case-sensitively, so "A@x" and "a@x" would
// otherwise be two different accounts. The login action normalises the same way.
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const force = process.env.BOOTSTRAP_ADMIN_FORCE === "1";

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  if (!email || !password) {
    fail(
      "ต้องตั้ง BOOTSTRAP_ADMIN_EMAIL และ BOOTSTRAP_ADMIN_PASSWORD ใน .env.local ก่อน\n" +
        "    (ดูตัวอย่างใน .env.example)",
    );
  }
  if (password.length < 12) {
    fail("BOOTSTRAP_ADMIN_PASSWORD ต้องยาวอย่างน้อย 12 ตัวอักษร");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("ไม่พบ DATABASE_URL");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // `cmu_account` is the local part of the CMU email — the field CMU OAuth
    // matches on (D6). Derived here so an OAuth login for the same person works.
    //
    // Only for an actual @cmu.ac.th address: `resolveCmuAccount()` never
    // returns anything but a bare CMU local part, so deriving one the same way
    // from a break-glass email on another domain (e.g. "admin@gmail.com" ->
    // "admin") would let a real CMU account of that name sign in as this
    // SUPERADMIN instead. The full email can't collide with that — it's never
    // bare.
    const cmuAccount = email.endsWith("@cmu.ac.th") ? email.split("@")[0] : email;
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && !force) {
      console.log(
        `\n  • มีบัญชี ${email} อยู่แล้ว (id=${existing.id}, role=${existing.role}) — ไม่แก้ไขอะไร` +
          `\n    ถ้าต้องการตั้งรหัสผ่านใหม่ ให้รันด้วย BOOTSTRAP_ADMIN_FORCE=1\n`,
      );
      return;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: await hashPassword(password),
        role: "SUPERADMIN",
        status: true,
        mustResetPassword: false,
      },
      create: {
        email,
        cmuAccount,
        password: await hashPassword(password),
        prefix: null,
        firstname: "ผู้ดูแล",
        lastname: "ระบบ",
        role: "SUPERADMIN",
        status: true,
      },
    });

    console.log(
      `\n  ✓ ${existing ? "ตั้งรหัสผ่านใหม่ให้" : "สร้าง"} SUPERADMIN แล้ว` +
        `\n    id=${user.id}  email=${user.email}  cmu_account=${user.cmuAccount}` +
        `\n\n    เปลี่ยนรหัสผ่านหลังเข้าระบบครั้งแรก และอย่าใช้รหัสนี้ซ้ำที่อื่น\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
