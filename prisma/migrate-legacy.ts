/**
 * F32 — ย้ายข้อมูล ITA / OIT / ไฟล์ จากระบบ Laravel เดิมเข้า PostgreSQL
 *
 *   npm run db:migrate-legacy -- --dry-run     # ดูก่อน ไม่เขียนอะไรเลย
 *   npm run db:migrate-legacy                  # ย้ายจริง
 *   npm run db:migrate-legacy -- --force       # ย้ายจริง โดยลบข้อมูลปีเหล่านั้นทิ้งก่อน
 *
 * แหล่งข้อมูล: Public API ของระบบเดิม + โฟลเดอร์ไฟล์ที่เปิดสาธารณะ
 * ไม่ต้องใช้ mysqldump และไม่ย้ายตาราง users (decisions.md D13 / D14 / D15)
 *
 * สิ่งที่ต้องรู้ก่อนอ่านโค้ด:
 *
 * - ชื่อไฟล์ในคลัง (`ItaFile.name`) เอามาจาก **ข้อความในแท็ก <a>** ของเนื้อหา OIT
 *   ไม่ใช่ชื่อไฟล์บนดิสก์ซึ่งเป็น timestamp ล้วน (D15) — ตรวจกับข้อมูลจริงแล้วว่าใช้ได้ครบทุกไฟล์
 * - ไฟล์บนดิสก์ต้องใช้ **ชื่อเดิมเป๊ะ** เพราะ F22 จับคู่ `ItaFile.path` กับชื่อไฟล์จริง
 *   ถ้าเปลี่ยนชื่อ ลิงก์เก่าทุกอันจะ 404
 * - id เดิม **ไม่ถูกคงไว้** — ฐานข้อมูลปลายทางอาจมีแถวอยู่แล้ว (เช่น id ชนกัน)
 *   จึงใช้ id ใหม่ แล้วเก็บ map ไว้ต่อ OIT เข้ากับ ITA แม่ระหว่างรัน
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Standalone via tsx, so nothing has loaded the env files yet (same as seed.ts).
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// ── ตั้งค่า ────────────────────────────────────────────────────────────────

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? "https://dev.nurse.cmu.ac.th/fonita";

/**
 * ช่วงปีที่ย้าย (decisions.md D16). ยิงจริงแล้วปี 2565 ลงไปว่างเปล่าทุกปี —
 * เผื่อไว้เพื่อให้สคริปต์ยังเก็บได้ถ้ามีใครกรอกข้อมูลปีเก่าเข้าระบบเดิมภายหลัง
 */
const YEAR_FROM = 2565;
const YEAR_TO = 2569;

/** บัญชีตัวแทนที่แถวที่ย้ายมาชี้ถึง — ล็อกอินไม่ได้ทั้งสองช่องทาง (D14) */
const PLACEHOLDER = {
  // .invalid เป็น TLD สงวนตาม RFC 2606 — ส่งอีเมลไปไม่ถึงแน่นอน
  email: "legacy-import@fon-ita.invalid",
  // ต้องไม่มีวันตรงกับบัญชี CMU จริง ไม่งั้นแถวนี้จะกลายเป็นช่องทางล็อกอิน (D6/D15)
  cmuAccount: "legacy-import",
  firstname: "ข้อมูลเดิม",
  lastname: "(ระบบเก่า)",
};

/** F17 จำกัดเนื้อหาที่ 1000 ตัวอักษร — ที่นี่แค่รายงาน ไม่บล็อก (ดูเหตุผลใน migrateOits) */
const CONTENT_LIMIT = 1000;

// ── ชนิดข้อมูลฝั่ง API เดิม ────────────────────────────────────────────────

type LegacyOit = {
  id: number;
  ita_id: string;
  title: string;
  link: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

type LegacyIta = {
  id: number;
  title: string;
  year: string;
  order: string;
  created_at: string;
  updated_at: string;
  oits: LegacyOit[];
};

/** ไฟล์หนึ่งไฟล์ที่พบในเนื้อหา */
type FileRef = {
  /** ชื่อไฟล์บนดิสก์ เช่น "1714459019.pdf" */
  storedName: string;
  /** ข้อความในแท็ก <a> — กลายเป็น ItaFile.name */
  label: string;
  /** วันที่ของ OIT ที่อ้างถึงไฟล์นี้เป็นครั้งแรก — ใช้เป็น createdAt */
  firstSeen: Date;
};

// ── ตัวช่วย ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

function log(line = ""): void {
  console.log(line);
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/** ดึง JSON พร้อม retry — ยิงข้ามอินเทอร์เน็ตจริง พลาดครั้งเดียวไม่ควรล้มทั้งงาน */
async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "fon-ita-migration/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (attempt >= attempts) throw error;
      log(`    … ลองใหม่ (${attempt}/${attempts}): ${String(error)}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchBinary(url: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "fon-ita-migration/1.0" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= attempts) throw error;
      log(`    … ลองใหม่ (${attempt}/${attempts}): ${String(error)}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * หา <a> ทุกตัวที่ชี้ไปไฟล์ในคลัง
 *
 * จับที่ส่วนท้าย `/storage/itafile/<ชื่อไฟล์>` โดยไม่สนโฮสต์ เพราะเนื้อหาเดิมมีทั้ง
 * ลิงก์เต็มและลิงก์แบบ path เปล่า และเคยเปลี่ยนโดเมนมาแล้วอย่างน้อยครั้งหนึ่ง
 */
const FILE_LINK = /<a\b[^>]*href="([^"]*\/storage\/itafile\/([^"?#]+))[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

/** ข้อความล้วนจาก HTML ชิ้นเล็ก ๆ (ข้อความในแท็ก <a>) */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── ขั้นตอนหลัก ───────────────────────────────────────────────────────────

async function loadLegacy(): Promise<LegacyIta[]> {
  const all: LegacyIta[] = [];

  for (let year = YEAR_TO; year >= YEAR_FROM; year--) {
    const rows = await fetchJson<LegacyIta[]>(`${LEGACY_ORIGIN}/api/v1/ita/${year}`);
    const oits = rows.reduce((sum, ita) => sum + ita.oits.length, 0);
    log(`  • ${year}: ${rows.length} ITA · ${oits} OIT${rows.length === 0 ? "  (ว่าง — ข้าม)" : ""}`);
    all.push(...rows);
  }

  return all;
}

/**
 * รวบรวมไฟล์ที่ถูกอ้างถึง พร้อมชื่อที่จะใช้ในคลัง
 *
 * ไฟล์ที่อยู่ในคลังเดิมแต่ไม่เคยถูกแนบใน OIT ไหนเลยจะไม่ถูกเก็บมา — ยอมรับตาม D15
 * เพราะไม่มีอะไรบนหน้าเว็บสาธารณะลิงก์ถึงมัน
 */
function collectFiles(itas: LegacyIta[]): Map<string, FileRef> {
  const files = new Map<string, FileRef>();

  for (const ita of itas) {
    for (const oit of ita.oits) {
      if (!oit.content) continue;
      const createdAt = new Date(oit.created_at);

      for (const match of oit.content.matchAll(FILE_LINK)) {
        const storedName = decodeURIComponent(match[2]);
        const label = plainText(match[3]);
        const existing = files.get(storedName);

        if (!existing) {
          files.set(storedName, { storedName, label, firstSeen: createdAt });
          continue;
        }
        // ไฟล์เดียวกันถูกอ้างหลายที่ — เก็บวันที่เก่าที่สุด และเก็บชื่อแรกที่ไม่ว่าง
        if (createdAt < existing.firstSeen) existing.firstSeen = createdAt;
        if (!existing.label && label) existing.label = label;
      }
    }
  }

  return files;
}

/**
 * ตั้งชื่อในคลังให้ไม่ซ้ำ — `ItaFile.name` เป็น unique
 *
 * ข้อมูลจริงมีข้อความซ้ำข้ามไฟล์อยู่คู่เดียว แต่ต้องกันไว้ ไม่งั้น insert ล้มกลางคัน
 * ชื่อที่ว่าง (ลิงก์ไม่มีข้อความ) ตกกลับไปใช้ชื่อไฟล์บนดิสก์
 */
function assignNames(files: FileRef[], taken: Set<string>): Map<string, string> {
  const names = new Map<string, string>();

  for (const file of files) {
    const base = (file.label || path.parse(file.storedName).name).slice(0, 255);
    let name = base;
    for (let n = 2; taken.has(name); n++) {
      name = `${base} (${n})`;
    }
    taken.add(name);
    names.set(file.storedName, name);
  }

  return names;
}

/** เปลี่ยนลิงก์ไฟล์ในเนื้อหาให้ชี้มาที่ระบบเรา */
function rewriteLinks(content: string, fileUrl: (storedName: string) => string): string {
  return content.replace(
    /(<a\b[^>]*href=")([^"]*\/storage\/itafile\/([^"?#]+))([^"]*)(")/gi,
    (_full, before: string, _url: string, encodedName: string, _rest: string, after: string) =>
      `${before}${fileUrl(decodeURIComponent(encodedName))}${after}`,
  );
}

async function main() {
  log(`\n  ── F32 · ย้ายข้อมูลจากระบบเดิม ${dryRun ? "(DRY RUN — ไม่เขียนอะไรทั้งสิ้น)" : ""}`);
  log(`  ต้นทาง: ${LEGACY_ORIGIN}  ·  ปี ${YEAR_FROM}–${YEAR_TO}\n`);

  // NEXT_PUBLIC_BASE_PATH ถูกใส่ให้โดย next.config.ts ตอนบิลด์ ซึ่งไม่มีในสคริปต์เดี่ยว —
  // ตั้งค่า default ก่อน แล้วค่อย import ตัวสร้าง URL เพื่อให้ยังใช้ helper ตัวเดียวกับแอป
  process.env.NEXT_PUBLIC_BASE_PATH ??= "/fonita";
  const { fileUrl } = await import("../src/lib/files/url");
  const { sanitizeHtml, htmlToText } = await import("../src/lib/sanitize");
  const { uploadRoot, allowedExtensions } = await import("../src/lib/files/storage");

  log("  [1/5] ดึงข้อมูลจาก API เดิม");
  const itas = await loadLegacy();
  const totalOits = itas.reduce((sum, ita) => sum + ita.oits.length, 0);
  if (itas.length === 0) fail("ไม่พบข้อมูลเลยในช่วงปีที่กำหนด");

  log(`\n  [2/5] แกะลิงก์ไฟล์จากเนื้อหา OIT`);
  const fileMap = collectFiles(itas);
  const files = [...fileMap.values()];
  const allowed = new Set(allowedExtensions());
  const oddExtensions = files.filter(
    (f) => !allowed.has(path.extname(f.storedName).replace(".", "").toLowerCase()),
  );
  const unnamed = files.filter((f) => !f.label);
  log(`  • ไฟล์ไม่ซ้ำ ${files.length} ไฟล์`);
  if (unnamed.length) log(`  ⚠ ลิงก์ที่ไม่มีข้อความ ${unnamed.length} — จะใช้ชื่อไฟล์แทน`);
  if (oddExtensions.length) {
    log(`  ⚠ นามสกุลนอกรายการที่อนุญาต ${oddExtensions.length}: ` +
      oddExtensions.map((f) => f.storedName).join(", "));
  }

  // เนื้อหาที่ยาวเกินลิมิตของ F17 ยังย้ายมาทั้งหมด แต่ต้องรู้ล่วงหน้าว่ามีกี่รายการ:
  // เจ้าหน้าที่ที่เปิดแก้ OIT เหล่านี้จะโดน validation ปฏิเสธจนกว่าจะตัดเนื้อหาให้สั้นลง
  const overLimit: string[] = [];
  for (const ita of itas) {
    for (const oit of ita.oits) {
      if (oit.content && htmlToText(sanitizeHtml(oit.content)).length > CONTENT_LIMIT) {
        overLimit.push(`${ita.year} · ${oit.title}`);
      }
    }
  }

  log(`\n  สรุปสิ่งที่จะย้าย`);
  log(`  • ITA ${itas.length} หัวข้อ · OIT ${totalOits} รายการ · ไฟล์ ${files.length} ไฟล์`);
  if (overLimit.length) {
    log(`  ⚠ OIT ที่เนื้อหาเกิน ${CONTENT_LIMIT} ตัวอักษร ${overLimit.length} รายการ — ย้ายมาครบ`);
    log(`    แต่ถ้าเปิดแก้ไขในระบบใหม่จะบันทึกไม่ได้จนกว่าจะตัดให้สั้นลง:`);
    for (const item of overLimit.slice(0, 10)) log(`      – ${item}`);
    if (overLimit.length > 10) log(`      … อีก ${overLimit.length - 10} รายการ`);
  }

  if (dryRun) {
    log(`\n  ✓ DRY RUN จบแล้ว — ไม่มีอะไรถูกเขียน\n`);
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("ไม่พบ DATABASE_URL");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // ป้องกันการทับข้อมูลที่มีอยู่: ปีปลายทางอาจมีหัวข้อที่สร้างผ่านหน้าเว็บไปแล้ว
    const years = [...new Set(itas.map((i) => i.year))];
    const clash = await prisma.ita.count({ where: { year: { in: years } } });
    if (clash > 0 && !force) {
      fail(
        `ฐานข้อมูลปลายทางมีหัวข้อ ITA ในปีเหล่านี้อยู่แล้ว ${clash} แถว\n` +
          `    รันด้วย --force ถ้าต้องการลบทิ้งแล้วย้ายใหม่ (OIT จะถูกลบตาม cascade)`,
      );
    }
    if (clash > 0) {
      const removed = await prisma.ita.deleteMany({ where: { year: { in: years } } });
      log(`\n  [3/5] --force: ลบ ITA เดิมในปีเหล่านั้น ${removed.count} แถว (OIT ตามไปด้วย)`);
    } else {
      log(`\n  [3/5] ไม่มีข้อมูลเดิมชนกัน`);
    }

    const owner = await prisma.user.upsert({
      where: { email: PLACEHOLDER.email },
      update: {},
      create: {
        ...PLACEHOLDER,
        role: "USER",
        // ปิดใช้งาน + ไม่มีรหัสผ่าน = ล็อกอินไม่ได้ทั้งฟอร์มและ CMU OAuth
        status: false,
        password: null,
      },
    });
    log(`  • บัญชีตัวแทน id=${owner.id} (${owner.email}, status=false)`);

    log(`\n  [4/5] โหลดไฟล์และสร้างแถวในคลัง`);
    const root = uploadRoot();
    await mkdir(root, { recursive: true });

    const existingRows = await prisma.itaFile.findMany({ select: { name: true, path: true } });
    const existingPaths = new Set(existingRows.map((r) => r.path));
    const takenNames = new Set(existingRows.map((r) => r.name));
    const names = assignNames(
      files.filter((f) => !existingPaths.has(f.storedName)),
      takenNames,
    );

    let downloaded = 0;
    let skipped = 0;
    const failedFiles: string[] = [];

    for (const file of files) {
      if (existingPaths.has(file.storedName)) {
        skipped++;
        continue;
      }
      try {
        const bytes = await fetchBinary(
          `${LEGACY_ORIGIN}/storage/itafile/${encodeURIComponent(file.storedName)}`,
        );
        // ชื่อบนดิสก์ต้องตรงกับคอลัมน์ path เป๊ะ ไม่งั้น F22 หาไม่เจอ
        await writeFile(path.join(root, file.storedName), bytes);
        await prisma.itaFile.create({
          data: {
            userId: owner.id,
            createdBy: PLACEHOLDER.firstname,
            name: names.get(file.storedName) ?? file.storedName,
            path: file.storedName,
            createdAt: file.firstSeen,
            updatedAt: file.firstSeen,
          },
        });
        downloaded++;
        if (downloaded % 20 === 0) log(`    … ${downloaded}/${files.length - skipped}`);
      } catch (error) {
        // ไฟล์ที่หายไปจากระบบเดิมไม่ควรทำให้การย้ายทั้งหมดล้ม — เก็บไว้รายงานท้ายสุด
        failedFiles.push(`${file.storedName} — ${String(error)}`);
      }
    }
    log(`  • โหลดสำเร็จ ${downloaded} · มีอยู่แล้ว ${skipped} · ล้มเหลว ${failedFiles.length}`);

    log(`\n  [5/5] เขียน ITA + OIT`);
    let oitCount = 0;
    const leftoverLinks: string[] = [];
    const legacyHost = new URL(LEGACY_ORIGIN).host;

    for (const legacy of itas) {
      const ita = await prisma.ita.create({
        data: {
          userId: owner.id,
          title: legacy.title,
          year: legacy.year,
          // API เดิมคืน order เป็น string (F27) — ที่นี่เป็น Int
          order: Number(legacy.order),
          createdAt: new Date(legacy.created_at),
          updatedAt: new Date(legacy.updated_at),
        },
      });

      for (const oit of legacy.oits) {
        // ลำดับสำคัญ: เปลี่ยนลิงก์ก่อน แล้วค่อย sanitize เพื่อให้ตัว sanitizer
        // เป็นด่านสุดท้ายเสมอ (D3 — sanitize ทุกครั้งที่บันทึก)
        const content = oit.content
          ? sanitizeHtml(rewriteLinks(oit.content, fileUrl)) || null
          : null;

        for (const url of content?.match(/https?:\/\/[^"'\s<>]+/g) ?? []) {
          if (url.includes(legacyHost)) leftoverLinks.push(`${legacy.year} · ${oit.title} → ${url}`);
        }

        await prisma.oit.create({
          data: {
            itaId: ita.id,
            title: oit.title,
            link: oit.link,
            content,
            createdAt: new Date(oit.created_at),
            updatedAt: new Date(oit.updated_at),
          },
        });
        oitCount++;
      }
    }

    log(`  • ITA ${itas.length} แถว · OIT ${oitCount} แถว`);

    if (leftoverLinks.length) {
      // ลิงก์ที่ยังชี้กลับไปโฮสต์เดิมหลังเขียนใหม่แล้ว = ลิงก์ที่ไม่ได้อยู่ในคลังไฟล์
      // (คนละโฟลเดอร์กับ /storage/itafile) จึงจับคู่กับแถวในคลังไม่ได้
      // ต้องรายงาน ไม่ใช่ปล่อยเงียบ เพราะเมื่อระบบเดิมถูกปิด ลิงก์พวกนี้จะตายทันที
      log(`\n  ⚠ ลิงก์ที่ยังชี้ไปโฮสต์ระบบเดิม ${leftoverLinks.length} รายการ — ไม่ได้อยู่ในคลังไฟล์ ย้ายตามมาไม่ได้`);
      for (const line of leftoverLinks) log(`    – ${line}`);
    }

    if (failedFiles.length) {
      log(`\n  ⚠ ไฟล์ที่โหลดไม่สำเร็จ (ลิงก์ในเนื้อหาจะเสีย ต้องตามเก็บเอง):`);
      for (const line of failedFiles) log(`    – ${line}`);
    }

    log(`\n  ✓ ย้ายข้อมูลเสร็จแล้ว\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
