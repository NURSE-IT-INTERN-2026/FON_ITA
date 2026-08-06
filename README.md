# FON-ITA · ระบบจัดการข้อมูลสาธารณะ

> ระบบภายในของ **คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่** สำหรับจัดการและเผยแพร่ข้อมูล ITA/OIT
> (Integrity & Transparency Assessment) ประจำปี — ปรับปรุงจากระบบเดิมที่ทำงานบน Laravel 8 / PHP 7.4 / MySQL

ระบบนี้ให้เจ้าหน้าที่บันทึกหัวข้อ ITA และรายการ OIT ของแต่ละปี (พ.ศ.) แล้วเปิดเผยผ่าน **Public API**
ที่เว็บหลักของคณะดึงไปแสดงผล รวมทั้งจัดการคลังไฟล์เอกสาร การจัดการผู้ใช้ และประวัติการใช้งาน

## ภาพรวม

- **4 กลุ่มผู้ใช้:** สาธารณะ (ไม่ต้องเข้าสู่ระบบ) · USER · ADMIN · SUPERADMIN
- **2 ช่องทางเข้าสู่ระบบ:** CMU OAuth (Microsoft Entra ID) SSO และ email + password (scrypt)
- **Public API** ที่เว็บคณะบริโภค — สัญญาของ JSON ถูกแช่แข็งเพื่อให้เทียบเท่าระบบ Laravel เดิม 100%
- **ติดตั้งใต้ basePath `/fonita`** ของโดเมนคณะ (เช่น `https://service.nurse.cmu.ac.th/fonita`)

## Tech Stack

| กลุ่ม | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript 5 |
| ฐานข้อมูล | PostgreSQL 16 · Prisma 7 |
| Auth | Custom — opaque token + DB Session · scrypt (password) · CMU OAuth (SSO) — **ไม่ใช้** Auth.js/Lucia/NextAuth |
| Validation | Zod ที่ทุก Server Action / Route Handler boundary |
| UI | Tailwind CSS v4 · shadcn-style primitives (Radix UI) · Tiptap (rich text) |
| Runtime | Node.js (proxy, server actions) — ไม่ใช้ Edge |

## เริ่มต้นพัฒนา

ต้องมี **Node.js 20+**, **Docker** (สำหรับ PostgreSQL), และ **pnpm หรือ npm**

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้างไฟล์ .env.local จาก template (ไม่ได้แนบมาใน repo)
cp .env.example .env.local
# แล้วกรอกค่าจริง — โดยเฉพาะ OAuth credentials และ SESSION_SECRET

# 3. เริ่ม PostgreSQL ใน Docker (container ชื่อ fonita-pg)
npm run db:up

# 4. รัน migration
npm run db:migrate

# 5. เริ่ม dev server
npm run dev
```

เปิด http://localhost:3000/fonita ในเบราว์เซอร์ (อย่าลืม `/fonita` — ระบบ mount ใต้ basePath นี้)

## Scripts ที่ใช้บ่อย

```bash
npm run dev              # รัน dev server
npm run build            # สร้าง production build
npm run start            # รัน production server

npm run db:up            # เริ่ม PostgreSQL ใน Docker
npm run db:migrate       # รัน Prisma migration
npm run db:generate      # สร้าง Prisma Client
npm run db:studio        # เปิด Prisma Studio (ดู/แก้ข้อมูลใน DB)
npm run db:seed          # ใส่ข้อมูลตัวอย่าง
npm run db:migrate-legacy # ย้ายข้อมูลจากระบบ Laravel เดิม

npm run api:verify       # ตรวจสัญญา Public API กับระบบเดิม (119 ข้อ)
npm run lint             # รัน ESLint
```

## โครงสร้างโปรเจค

```
src/
├── app/                      # App Router (pages, layouts, route handlers)
│   ├── (auth)/               # หน้า login (ไม่มี shell)
│   ├── (app)/                # หน้าที่มี shell (หลังเข้าสู่ระบบ)
│   ├── (public)/             # หน้าสาธารณะ (หน้าแรก, ค้นหา ITA)
│   └── api/                  # Route Handlers รวม Public API
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── public/               # คอมโพเนนต์หน้าสาธารณะ
│   └── ...                   # คอมโพเนนต์ feature ต่าง ๆ
├── lib/
│   ├── auth/                 # session, scrypt, RBAC
│   ├── api/                  # ตัวแปลงร่างสำหรับ Public API (legacy compat)
│   ├── db/                   # Prisma client
│   └── ...
└── ...

prisma/
├── schema.prisma             # schema ของฐานข้อมูล
├── migrations/               # migration SQL
└── seed.ts                   # ข้อมูลเริ่มต้น

scripts/
└── verify-api-contract.ts    # สคริปต์ตรวจสัญญา Public API
```

## Public API (สัญญาที่แช่แข็ง)

เว็บหลักของคณะ (`Info.aspx`) เรียก API ทั้งสองตัวนี้อยู่ — **ชื่อฟิลด์ ชนิดข้อมูล และลำดับคีย์ต้องตรงระบบเดิมเป๊ะ**

| Endpoint | คำอธิบาย |
|---|---|
| `GET /api/v1/ita/{year}` | ดึงหัวข้อ ITA ทั้งหมดของปีนั้น พร้อม OIT (eager-load) — JSON array |
| `GET /api/nurse/youtube-feed` | Proxy RSS ของช่อง YouTube คณะ 2 รายการล่าสุด |
| `GET /api/v1/ita/{year}/stream` | เดียวกันแต่ส่งเป็น NDJSON |
| `GET /api/v1/ita-years` | (ของเราเอง) คืนรายการปีที่มีข้อมูล |

ตัวอย่าง URL ที่ consumer เรียก: `https://service.nurse.cmu.ac.th/fonita/api/v1/ita/2569`

ตรวจความถูกต้องของสัญญาอัตโนมัติ:

```bash
npm run api:verify                       # เทียบกับระบบเดิมที่ dev.nurse.cmu.ac.th
npm run api:verify -- --year 2569        # เจาะปีเดียว
npm run api:verify -- --offline          # ไม่ต่อระบบเดิม
```

## การตั้งค่า Environment

ตัวแปร environment ทั้งหมดอยู่ใน `.env.example` — สำเนาเป็น `.env.local` แล้วกรอกค่าจริง
รายละเอียดแต่ละตัวอยู่ในไฟล์ตัวอย่างนั้น (เพื่อกันลืม sync ระหว่างสองไฟล์)

> ⚠️ **ห้าม commit `.env.local`** — เก็บ secrets ทั้งหมดไว้ที่นั่น

## การ Deploy

- ติดตั้งใต้ `/fonita` ของโดเมนคณะ ผ่าน reverse proxy ของทีม ops
- PostgreSQL สำหรับ production แยกจาก Docker container ของ dev
- รายละเอียศ deploy อยู่ในเอกสารภายใน (ถามทีม ops)

## การพัฒนาต่อ

เอกสาร spec เต็ม ๆ (PRD, technical spec, chapter details, decision log) อยู่ใน `docs/` แต่ไม่ได้ commit ขึ้น repo
เพราะมีรายละเอียดภายใน — ทีมพัฒนาสามารถอ่านได้จากเครื่องที่ clone มาครบถ้วน

กฎสำคัญที่ต้องรู้ตอนเขียนโค้ด:

- **Server Components เป็น default** — เปลี่ยนเป็น Client Component เฉพาะตอนต้องใช้ hook/event handler
- **ใช้ `proxy.ts`** สำหรับ route protection / RBAC — ไม่ใช่ `middleware.ts` (Next.js 16 เปลี่ยนชื่อ)
- **API เดิมทุก async** — `cookies()`, `headers()`, `params`, `searchParams` ต้อง `await`
- **basePath `/fonita`** — การ `redirect()`, `<Link>`, `router.push()` ไม่ต้องใส่ basePath (เติมให้อัตโนมัติ)
  แต่ `fetch()` ภายในแอป และ path ของ cookie **ต้องใส่** `/fonita` เอง
- **ตรวจ RBAC สองชั้น** — ที่ proxy (gate แรก) และที่ Server Action (decision จริง) ไม่ตามใจ UI
- **ภาษาไทย** สำหรับทุก user-facing text · enum value ใน DB/code เป็น English · ปีใช้พุทธศักราช (พ.ศ.)

## License

โค้ดส่วนที่เป็น internal ของคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ — ไม่เปิดเป็น open source
