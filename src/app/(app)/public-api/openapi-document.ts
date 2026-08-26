/**
 * OpenAPI 3.1 document for the frozen Public API (docs/chapters/05-public-api.md).
 *
 * Documentation only — nothing here is the contract itself; every field, type,
 * quirk and status code is transcribed from the real route handlers
 * (src/app/api/v1/ita/[year]/route.ts, src/app/api/nurse/youtube-feed/route.ts
 * and lib/api/legacy-ita.ts) so the reference can never drift silently. When a
 * route changes, this file has to follow.
 *
 * Legacy quirks are documented as-is (order/ita_id are strings, an invalid
 * year returns 200 + []) because the faculty website depends on them.
 */

const RATE_LIMIT_HEADERS = {
  "X-RateLimit-Limit": {
    description: "จำนวนคำขอสูงสุดต่อนาที (60)",
    schema: { type: "integer", example: 60 },
  },
  "X-RateLimit-Remaining": {
    description: "โควตาที่เหลือในนาทีปัจจุบัน",
    schema: { type: "integer", example: 58 },
  },
};

export function buildOpenApiDocument(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "FON-ITA Public API",
      version: "1.0.0",
      summary: "API สาธารณะที่เว็บไซต์หลักของคณะใช้ดึงข้อมูล ITA/OIT",
      description: [
        "API นี้คือช่องทางที่เว็บไซต์หลักของคณะพยาบาลศาสตร์ มช. ดึงข้อมูล ITA/OIT ไปแสดงผล — ระบบ FON-ITA เป็นคลังข้อมูลต้นทาง ส่วนเว็บหลักเป็นผู้เรียกใช้",
        "",
        "**ข้อกำหนดสำคัญ**",
        "- ไม่ต้องยืนยันตัวตน (public) — ใช้ได้ทันทีไม่ต้องขอ token",
        "- จำกัด **60 คำขอ/นาที** ต่อผู้ใช้ เทียบเท่าระบบ Laravel เดิม — เกินแล้วได้ `429` พร้อมหัว `Retry-After`",
        "- สัญญา (contract) ถูกแช่แข็งให้เหมือนระบบเดิม 100% — ห้ามเปลี่ยนชื่อคีย์ ชนิดข้อมูล หรือโครงสร้าง JSON แม้แต่จุดเดียว",
        "- ปีที่ไม่มีข้อมูล หรือค่าปีไม่ถูกต้อง ได้ `200` พร้อมอาร์เรย์ว่าง `[]` เสมอ ไม่ใช่ `404`",
        "",
        "กด **Test Request** ในแต่ละ endpoint เพื่อทดลองยิง request จริงจากหน้านี้ได้เลย",
      ].join("\n"),
    },
    servers: [{ url: serverUrl, description: "เซิร์ฟเวอร์ปัจจุบัน" }],
    tags: [
      {
        name: "ITA",
        description: "ข้อมูลหัวข้อ ITA และรายการย่อย OIT รายปี พ.ศ. — สำหรับหน้าเปิดเผยข้อมูลของคณะ",
      },
      {
        name: "YouTube Feed",
        description: "วิดีโอล่าสุดจากช่อง YouTube ของคณะ — proxy Atom feed เพราะเบราว์เซอร์เรียกตรงไปที่ YouTube ไม่ได้ (ไม่มี CORS)",
      },
    ],
    paths: {
      "/api/v1/ita/{year}": {
        get: {
          tags: ["ITA"],
          summary: "ดึงหัวข้อ ITA และ OIT ทั้งหมดของปีที่ระบุ",
          description:
            "คืนอาร์เรย์ของ ITA ปีนั้น เรียงตามลำดับที่เจ้าหน้าที่จัดไว้ (order) แต่ละรายการมี `oits` (รายการย่อย) เรียงตาม id ตามระบบเดิม\n\n**ปีที่ไม่มีข้อมูล → `200` + `[]`** ไม่ใช่ 404 — เว็บคณะไล่ปีถอยหลังเพื่อหาปีล่าสุดที่มีข้อมูล และถือว่า response ที่ไม่ใช่อาร์เรย์คือข้อผิดพลาดร้ายแรง",
          operationId: "getItasByYear",
          parameters: [
            {
              name: "year",
              in: "path",
              required: true,
              description: "ปี พ.ศ. 4 หลัก เช่น `2569` — ค่าอื่นที่ไม่ใช่ตัวเลข 4 หลัก ได้ `200` + `[]` เสมอ",
              schema: { type: "string", pattern: "^[0-9]{4}$", example: "2569" },
            },
          ],
          responses: {
            "200": {
              description: "สำเร็จ — อาร์เรย์ของ ITA (ว่างได้ถ้าปีนั้นไม่มีข้อมูล)",
              headers: RATE_LIMIT_HEADERS,
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Ita" },
                  },
                  example: [
                    {
                      id: 1,
                      title: "การเปิดเผยข้อมูลสาธารณะ",
                      year: "2569",
                      order: "1",
                      created_at: "2026-01-15T02:51:21.000000Z",
                      updated_at: "2026-02-20T09:12:33.000000Z",
                      oits: [
                        {
                          id: 1,
                          ita_id: "1",
                          title: "แผนการดำเนินงานประจำปี",
                          link: "https://www.nurse.cmu.ac.th/example",
                          content: "<p>เนื้อหา HTML ที่ผ่านการล้างแล้ว</p>",
                          created_at: "2026-01-15T02:51:21.000000Z",
                          updated_at: "2026-02-20T09:12:33.000000Z",
                        },
                      ],
                    },
                  ],
                },
              },
            },
            "429": {
              description: "ยิงเกิน 60 คำขอ/นาที — รอตามหัว `Retry-After` (วินาที) แล้วลองใหม่",
              headers: {
                ...RATE_LIMIT_HEADERS,
                "Retry-After": {
                  description: "วินาทีที่ต้องรอก่อนยิงใหม่",
                  schema: { type: "integer", example: 37 },
                },
              },
              content: {
                "application/json": {
                  example: { message: "Too Many Attempts." },
                },
              },
            },
            "500": {
              description: "ข้อผิดพลาดเซิร์ฟเวอร์ที่ไม่คาดคิด",
            },
          },
        },
      },
      "/api/nurse/youtube-feed": {
        get: {
          tags: ["YouTube Feed"],
          summary: "ดึงวิดีโอล่าสุดจากช่อง YouTube ของคณะ (ไม่เกิน 2 รายการ)",
          description:
            "CORS ของ endpoint นี้อนุญาตเฉพาะ `https://www.nurse.cmu.ac.th` เท่านั้น (ต่างจาก /api/v1/ita ที่เปิด `*`)\n\nรูปแบบ JSON เป็นผลจากการแปลง Atom feed ของ YouTube ตามระบบเดิม — โครงสร้าง `@attributes` ถูกกำหนดโดย PHP เดิมและถูกแช่แข็งไว้",
          operationId: "getYoutubeFeed",
          responses: {
            "200": {
              description: "สำเร็จ — อาร์เรย์ของวิดีโอล่าสุด (สูงสุด 2 รายการ ว่างได้ถ้าดึงจาก YouTube ไม่ได้)",
              headers: RATE_LIMIT_HEADERS,
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/YoutubeFeedEntry" },
                  },
                  example: [
                    {
                      id: "yt:video:dQw4w9WgXcQ",
                      title: "คลิปแนะนำคณะพยาบาลศาสตร์ มช.",
                      link: { "@attributes": { href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", rel: "alternate", type: "text/html" } },
                      author: { name: "คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่", uri: "https://www.youtube.com/channel/UCrsvXl143w91ND6BjGn9cZw" },
                      published: "2026-08-01T04:00:00.000000Z",
                      updated: "2026-08-01T04:00:00.000000Z",
                    },
                  ],
                },
              },
            },
            "429": {
              description: "ยิงเกิน 60 คำขอ/นาที — รอตามหัว `Retry-After` (วินาที) แล้วลองใหม่",
              headers: {
                ...RATE_LIMIT_HEADERS,
                "Retry-After": {
                  description: "วินาทีที่ต้องรอก่อนยิงใหม่",
                  schema: { type: "integer", example: 37 },
                },
              },
              content: {
                "application/json": {
                  example: { message: "Too Many Attempts." },
                },
              },
            },
            "500": {
              description: "ข้อผิดพลาดเซิร์ฟเวอร์ที่ไม่คาดคิด",
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Ita: {
          type: "object",
          title: "ITA",
          description: "หัวข้อ ITA หนึ่งรายการของปีนั้น ๆ",
          required: ["id", "title", "year", "order", "created_at", "updated_at", "oits"],
          properties: {
            id: { type: "integer", description: "รหัสหัวข้อ" },
            title: { type: "string", description: "ชื่อหัวข้อ ITA" },
            year: { type: "string", description: "ปี พ.ศ. เช่น `2569`" },
            order: { type: "string", description: "ลำดับการแสดงผล — **เป็น string โดยตั้งใจ** ตามระบบเดิม" },
            created_at: { type: "string", format: "date-time", description: "เวลาสร้าง — ทศนิยม 6 ตำแหน่งตามระบบเดิม" },
            updated_at: { type: "string", format: "date-time", description: "เวลาแก้ไขล่าสุด" },
            oits: {
              type: "array",
              description: "รายการย่อย OIT ภายใต้หัวข้อนี้ เรียงตาม id",
              items: { $ref: "#/components/schemas/Oit" },
            },
          },
        },
        Oit: {
          type: "object",
          title: "OIT",
          description: "รายการย่อยใต้หัวข้อ ITA",
          required: ["id", "ita_id", "title", "link", "content", "created_at", "updated_at"],
          properties: {
            id: { type: "integer", description: "รหัสรายการ" },
            ita_id: { type: "string", description: "รหัสหัวข้อแม่ — **เป็น string โดยตั้งใจ** ตามระบบเดิม" },
            title: { type: "string", description: "ชื่อรายการ OIT" },
            link: {
              type: ["string", "null"],
              description: "ลิงก์ภายนอก (มีหรือไม่มีก็ได้)",
            },
            content: {
              type: ["string", "null"],
              description: "เนื้อหา HTML ที่ผ่านการล้าง (DOMPurify) แล้ว — ว่างได้",
            },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        YoutubeFeedEntry: {
          type: "object",
          title: "YoutubeFeedEntry",
          description: "วิดีโอหนึ่งรายการจาก Atom feed ของช่อง YouTube คณะ",
          required: ["id", "title", "link", "author", "published", "updated"],
          properties: {
            id: { type: "string", description: "รหัสวิดีโอในรูปแบบ feed" },
            title: { type: "string", description: "ชื่อวิดีโอ" },
            link: {
              type: "object",
              description: "ลิงก์เปิดวิดีโอ — โครงสร้าง `@attributes` คงไว้ตามระบบเดิม",
              required: ["@attributes"],
              properties: {
                "@attributes": {
                  type: "object",
                  description: "แอตทริบิวต์ของลิงก์จาก Atom feed เช่น href, rel, type",
                  additionalProperties: { type: "string" },
                },
              },
            },
            author: {
              type: "object",
              required: ["name", "uri"],
              properties: {
                name: { type: "string", description: "ชื่อช่อง" },
                uri: { type: "string", description: "ลิงก์ช่อง" },
              },
            },
            published: { type: "string", format: "date-time", description: "เวลาเผยแพร่" },
            updated: { type: "string", format: "date-time", description: "เวลาอัปเดตล่าสุด" },
          },
        },
      },
    },
  };
}
