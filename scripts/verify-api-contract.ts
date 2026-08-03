/**
 * ตรวจว่า Public API ของเราตรงตาม "สัญญาที่แช่แข็ง" ของระบบเดิมจริงหรือไม่
 *
 *   npm run api:verify                       # เทียบกับระบบเดิมที่ dev.nurse.cmu.ac.th
 *   npm run api:verify -- --year 2568        # เจาะปีเดียว
 *   npm run api:verify -- --offline          # ไม่ต่อระบบเดิม ตรวจเฉพาะกฎในเอกสาร
 *
 * ตรวจ **รูปแบบ** ไม่ใช่ **เนื้อหา** — และนั่นคือสิ่งที่ถูกต้อง เพราะสามอย่างนี้
 * ต่างจากระบบเดิมโดยตั้งใจ (docs/chapters/05-public-api.md + F32):
 *
 *   1. `id` / `ita_id` — แถวใหม่ได้เลขใหม่จาก PostgreSQL ระบบเดิมใช้เลขของ MySQL
 *   2. `content` — ลิงก์ไฟล์ถูกเขียนใหม่ให้ชี้มาที่ระบบเรา แล้ว sanitize (D3)
 *   3. เนื้อหาที่เจ้าหน้าที่แก้หลังย้ายข้อมูล
 *
 * สิ่งที่ห้ามต่าง และสคริปต์นี้ตรวจให้: ชื่อคีย์ · **ลำดับคีย์** · ชนิดข้อมูล ·
 * รูปแบบ timestamp · การเรียงลำดับ · HTTP status · header
 *
 * ที่มาของกฎทุกข้อ: docs/chapters/05-public-api.md §6.1–6.4
 */

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const yearArg = args[args.indexOf("--year") + 1];

const OURS = process.env.VERIFY_ORIGIN ?? "http://localhost:3000/fonita";
const LEGACY = process.env.LEGACY_ORIGIN ?? "https://dev.nurse.cmu.ac.th/fonita";

// ── การรายงานผล ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      → ${detail}` : ""}`);
  }
}

function skip(label: string, why: string) {
  skipped++;
  console.log(`  \x1b[33m—\x1b[0m ${label}  (ข้าม: ${why})`);
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ── กฎที่มาจากเอกสาร ───────────────────────────────────────────────────────

/** §6.1 — ชื่อคีย์ **และลำดับ** ต้องตรง เพราะ JSON.stringify ของเราต้องออกมาหน้าตาเดียวกัน */
const ITA_KEYS = ["id", "title", "year", "order", "created_at", "updated_at", "oits"];
const OIT_KEYS = ["id", "ita_id", "title", "link", "content", "created_at", "updated_at"];

/** §6.1 — ISO ที่มีทศนิยม **6 หลัก** ลงท้าย Z (JS toISOString() ให้แค่ 3) */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

type Ita = Record<string, unknown> & { oits: Record<string, unknown>[] };

async function get(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ปล่อยเป็น null — ผู้เรียกเป็นคนตัดสินว่าจำเป็นต้อง parse ได้ไหม */
  }
  return { response, text, json };
}

/** ตรวจโครงสร้างของ payload หนึ่งชุดตามกฎ §6.1 ทั้งหมด */
function checkShape(source: string, rows: unknown) {
  check(`${source} — ระดับบนสุดเป็น array (ไม่ห่อด้วย object)`, Array.isArray(rows));
  if (!Array.isArray(rows) || rows.length === 0) {
    skip(`${source} — ตรวจฟิลด์`, "ไม่มีข้อมูลในปีนี้");
    return;
  }

  const itas = rows as Ita[];

  // ชื่อคีย์ + ลำดับคีย์
  const badItaKeys = itas.find((ita) => Object.keys(ita).join(",") !== ITA_KEYS.join(","));
  check(
    `${source} — คีย์ของ ITA ครบและเรียงถูก`,
    !badItaKeys,
    badItaKeys && `ได้ [${Object.keys(badItaKeys)}] · ต้องการ [${ITA_KEYS}]`,
  );

  const allOits = itas.flatMap((ita) => ita.oits ?? []);
  const badOitKeys = allOits.find((oit) => Object.keys(oit).join(",") !== OIT_KEYS.join(","));
  check(
    `${source} — คีย์ของ OIT ครบและเรียงถูก`,
    !badOitKeys,
    badOitKeys && `ได้ [${Object.keys(badOitKeys)}] · ต้องการ [${OIT_KEYS}]`,
  );

  // §6.1 — ชนิดข้อมูลที่ "ไม่สม่ำเสมอ" ซึ่งต้องเลียนแบบให้ตรง
  check(
    `${source} — ita.id เป็น number · ita.order เป็น string · ita.year เป็น string`,
    itas.every(
      (i) => typeof i.id === "number" && typeof i.order === "string" && typeof i.year === "string",
    ),
    itas[0] && `ตัวอย่าง: id=${typeof itas[0].id} order=${typeof itas[0].order}`,
  );

  check(
    `${source} — oit.id เป็น number · oit.ita_id เป็น string · oit.link เป็น string|null`,
    allOits.every(
      (o) =>
        typeof o.id === "number" &&
        typeof o.ita_id === "string" &&
        (o.link === null || typeof o.link === "string"),
    ),
    allOits[0] && `ตัวอย่าง: id=${typeof allOits[0].id} ita_id=${typeof allOits[0].ita_id}`,
  );

  // §6.1 — timestamp ทศนิยม 6 หลัก
  const badStamp = [...itas, ...allOits].find(
    (row) => !TIMESTAMP.test(String(row.created_at)) || !TIMESTAMP.test(String(row.updated_at)),
  );
  check(
    `${source} — timestamp เป็น ISO ทศนิยม 6 หลักลงท้าย Z`,
    !badStamp,
    badStamp && `ได้ "${badStamp.created_at}"`,
  );

  // §6.1 — ห้ามมี user_id หลุดออกไป
  const leaked = [...itas, ...allOits].some((row) => "user_id" in row);
  check(`${source} — ไม่มี user_id หลุดออกมา`, !leaked);

  // §6.1 + D20 — ลำดับต้องคงที่และคาดเดาได้ แต่ "คงที่ด้วยอะไร" ต่างกันสองฝั่ง:
  //
  //   ระบบเดิม เรียงตาม `id` (ไม่มี ORDER BY → InnoDB คืนตาม primary key)
  //   ระบบเรา  เรียงตาม `order` และสคริปต์ย้ายข้อมูลไล่เลขให้ผลลัพธ์ออกมาลำดับเดียวกัน
  //
  // จึงตรวจคนละคีย์ — ตัวที่พิสูจน์ว่า "ลำดับตรงกันจริง" คือการเทียบชื่อหัวข้อด้านล่าง
  const ids = itas.map((i) => Number(i.id));
  const orders = itas.map((i) => Number(i.order));
  const key = source === "ระบบเดิม" ? ids : orders;
  const keyName = source === "ระบบเดิม" ? "id" : "order";
  check(
    `${source} — ITA เรียงตาม ${keyName} น้อย→มาก (ลำดับคาดเดาได้)`,
    key.every((v, idx) => idx === 0 || key[idx - 1] <= v),
    `ได้ [${key}]`,
  );

  const oitOutOfOrder = itas.find((ita) => {
    const ids = (ita.oits ?? []).map((o) => Number(o.id));
    return ids.some((v, idx) => idx > 0 && ids[idx - 1] > v);
  });
  check(`${source} — OIT ในแต่ละหัวข้อเรียงตาม id น้อย→มาก`, !oitOutOfOrder);
}

async function main() {
  console.log(`\n  ── ตรวจสัญญา Public API`);
  console.log(`  ระบบเรา:  ${OURS}`);
  console.log(`  ระบบเดิม: ${offline ? "(ข้าม — โหมด --offline)" : LEGACY}`);

  const years = yearArg ? [yearArg] : ["2569", "2568", "2567", "2566"];

  // ── 1. โครงสร้าง JSON ────────────────────────────────────────────────────
  for (const year of years) {
    section(`§6.1 · /api/v1/ita/${year}`);

    const ours = await get(`${OURS}/api/v1/ita/${year}`);
    check(`ระบบเรา ตอบ HTTP 200`, ours.response.status === 200, `ได้ ${ours.response.status}`);
    checkShape("ระบบเรา", ours.json);

    if (offline) continue;

    const legacy = await get(`${LEGACY}/api/v1/ita/${year}`);
    if (legacy.response.status !== 200) {
      skip(`เทียบกับระบบเดิม`, `ระบบเดิมตอบ ${legacy.response.status}`);
      continue;
    }
    checkShape("ระบบเดิม", legacy.json);

    // เทียบสองฝั่ง — จำนวนหัวข้อและชื่อหัวข้อต้องตรง (id/เนื้อหาต่างได้ตามหัวไฟล์)
    const a = (ours.json ?? []) as Ita[];
    const b = (legacy.json ?? []) as Ita[];
    check(
      `จำนวนหัวข้อ ITA เท่ากัน (เรา ${a.length} · เดิม ${b.length})`,
      a.length === b.length,
    );
    check(
      `ชื่อหัวข้อและลำดับตรงกันทุกตัว`,
      JSON.stringify(a.map((i) => i.title)) === JSON.stringify(b.map((i) => i.title)),
      `เรา [${a.map((i) => i.title)}]\n      เดิม [${b.map((i) => i.title)}]`,
    );
    check(
      `จำนวน OIT ในแต่ละหัวข้อตรงกัน`,
      JSON.stringify(a.map((i) => i.oits?.length)) === JSON.stringify(b.map((i) => i.oits?.length)),
      `เรา [${a.map((i) => i.oits?.length)}] · เดิม [${b.map((i) => i.oits?.length)}]`,
    );
    check(
      `ชื่อ OIT ตรงกันทุกตัว`,
      JSON.stringify(a.flatMap((i) => (i.oits ?? []).map((o) => o.title))) ===
        JSON.stringify(b.flatMap((i) => (i.oits ?? []).map((o) => o.title))),
    );
    // D20 — ค่า `order` ของเราต่างจากเดิมได้ **เฉพาะเท่าที่จำเป็น** เพื่อให้เรียงขึ้นได้
    // โดยลำดับไม่เปลี่ยน · ตรวจด้วยการเล่นอัลกอริทึมเดียวกับ normalizeOrder() ซ้ำบน
    // ลำดับของระบบเดิม แล้วผลต้องออกมาเท่ากับที่ API ของเราส่งจริงทุกตัว —
    // ถ้าสคริปต์ย้ายข้อมูลไล่เลขผิดแม้แถวเดียว ข้อนี้จะจับได้
    let previous = -Infinity;
    const expected = b.map((ita) => {
      const original = Number(ita.order);
      previous = original > previous ? original : previous + 1;
      return String(previous);
    });
    const changed = expected.filter((v, idx) => v !== b[idx].order).length;
    check(
      `ค่า order ถูกไล่ใหม่เท่าที่จำเป็นเท่านั้น (ต่างจากเดิม ${changed} แถว)`,
      JSON.stringify(a.map((i) => i.order)) === JSON.stringify(expected),
      `เรา      [${a.map((i) => i.order)}]\n      ควรได้   [${expected}]\n      เดิม     [${b.map((i) => i.order)}]`,
    );
  }

  // ── 2. พฤติกรรมของปีที่ไม่มีข้อมูล ───────────────────────────────────────
  section(`§6.1 · ปีที่ไม่มีข้อมูล ต้องเป็น [] + HTTP 200 ห้าม 404`);
  for (const year of ["99999", "abc", "1900"]) {
    const { response, json } = await get(`${OURS}/api/v1/ita/${year}`);
    check(
      `/ita/${year} → 200 + array ว่าง`,
      response.status === 200 && Array.isArray(json) && json.length === 0,
      `ได้ ${response.status} · body=${JSON.stringify(json)?.slice(0, 40)}`,
    );
  }

  // ── 3. Header ────────────────────────────────────────────────────────────
  section(`§6.1 · header ที่ระบบเดิมส่ง`);
  {
    const { response } = await get(`${OURS}/api/v1/ita/2569`);
    const h = (name: string) => response.headers.get(name);
    check(`Content-Type: application/json`, (h("content-type") ?? "").includes("application/json"));
    check(`Access-Control-Allow-Origin: *`, h("access-control-allow-origin") === "*");
    check(
      `Cache-Control: private, must-revalidate`,
      (h("cache-control") ?? "").includes("private") &&
        (h("cache-control") ?? "").includes("must-revalidate"),
      `ได้ "${h("cache-control")}"`,
    );
    check(`Pragma: no-cache`, h("pragma") === "no-cache", `ได้ "${h("pragma")}"`);
    check(`Expires: -1`, h("expires") === "-1", `ได้ "${h("expires")}"`);
    check(`X-Content-Type-Options: nosniff`, h("x-content-type-options") === "nosniff");
    check(`X-RateLimit-Limit: 60`, h("x-ratelimit-limit") === "60", `ได้ "${h("x-ratelimit-limit")}"`);
    check(`มี X-RateLimit-Remaining`, h("x-ratelimit-remaining") !== null);
  }

  // ── 4. stream ต้องให้ข้อมูลเดียวกับ endpoint ปกติ ────────────────────────
  section(`§6.2.3 · /api/v1/ita/{year}/stream`);
  {
    const plain = await get(`${OURS}/api/v1/ita/2569`);
    const ndjson = await get(`${OURS}/api/v1/ita/2569/stream`, {
      Accept: "application/x-ndjson",
    });
    check(
      `Content-Type เป็น application/x-ndjson`,
      (ndjson.response.headers.get("content-type") ?? "").includes("application/x-ndjson"),
      `ได้ "${ndjson.response.headers.get("content-type")}"`,
    );
    check(`ส่ง X-Accel-Buffering: no กัน proxy อมข้อมูล`, ndjson.response.headers.get("x-accel-buffering") === "no");

    const lines = ndjson.text.trim() ? ndjson.text.trim().split("\n") : [];
    const rebuilt = lines.map((line) => JSON.parse(line));
    check(
      `ข้อมูลจาก stream เท่ากับ endpoint ปกติทุกฟิลด์`,
      JSON.stringify(rebuilt) === JSON.stringify(plain.json),
      `stream ${lines.length} บรรทัด · ปกติ ${(plain.json as unknown[])?.length} รายการ`,
    );

    // ไม่ส่ง Accept → ต้องตกกลับเป็น JSON array แบบเดิม
    const fallback = await get(`${OURS}/api/v1/ita/2569/stream`);
    check(
      `ไม่ส่ง Accept → ตกกลับเป็น JSON array`,
      Array.isArray(fallback.json) &&
        JSON.stringify(fallback.json) === JSON.stringify(plain.json),
    );
  }

  // ── 5. youtube-feed ──────────────────────────────────────────────────────
  section(`§6.2 · /api/nurse/youtube-feed`);
  {
    const { response, json } = await get(`${OURS}/api/nurse/youtube-feed`);
    check(`ตอบ HTTP 200`, response.status === 200);
    check(
      `CORS จำกัดเฉพาะ www.nurse.cmu.ac.th (ไม่ใช่ *)`,
      response.headers.get("access-control-allow-origin") === "https://www.nurse.cmu.ac.th",
      `ได้ "${response.headers.get("access-control-allow-origin")}"`,
    );

    const items = (json ?? []) as Record<string, unknown>[];
    check(`เป็น array`, Array.isArray(json));
    if (items.length === 0) {
      skip(`ตรวจรูปแบบรายการ`, "ดึง RSS ไม่ได้ (ออฟไลน์?) — โค้ดคืน [] ตามที่ออกแบบ");
    } else {
      check(`คืน 2 รายการล่าสุด`, items.length === 2, `ได้ ${items.length}`);
      const one = items[0];
      check(
        `คีย์ครบ: id · title · link · author · published · updated`,
        ["id", "title", "link", "author", "published", "updated"].every((k) => k in one),
        `ได้ [${Object.keys(one)}]`,
      );
      check(
        `link เป็น object ที่มี @attributes.href`,
        typeof one.link === "object" &&
          one.link !== null &&
          typeof (one.link as Record<string, Record<string, string>>)["@attributes"]?.href ===
            "string",
        `ได้ ${JSON.stringify(one.link)?.slice(0, 60)}`,
      );
      check(
        `author เป็น object ที่มี name และ uri`,
        typeof one.author === "object" &&
          one.author !== null &&
          "name" in (one.author as object) &&
          "uri" in (one.author as object),
      );
      check(
        `published/updated ลงท้าย +00:00 (ไม่ใช่ Z)`,
        String(one.published).endsWith("+00:00") && String(one.updated).endsWith("+00:00"),
        `ได้ "${one.published}"`,
      );
    }
  }

  // ── สรุป ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(
    `\n  ${failed === 0 ? "\x1b[32m✓ ผ่านทั้งหมด\x1b[0m" : "\x1b[31m✗ ไม่ผ่าน\x1b[0m"}  ` +
      `${passed}/${total} ข้อ` +
      (skipped ? ` · ข้าม ${skipped}` : "") +
      "\n",
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\n  สคริปต์ล้มเหลว:", error instanceof Error ? error.message : error);
  console.error("  (เซิร์ฟเวอร์ dev รันอยู่หรือเปล่า? — npm run dev)\n");
  process.exit(1);
});
