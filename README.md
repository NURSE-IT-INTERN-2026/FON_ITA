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

ต้องมี **Node.js 20+**, **Docker** (สำหรับ PostgreSQL), และ **npm** (repo ใช้ `package-lock.json`)

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
npm run db:seed          # สร้าง SUPERADMIN คนแรก (อ่าน BOOTSTRAP_ADMIN_EMAIL/PASSWORD)
npm run db:reset         # รีเซ็ต DB (ล้างข้อมูล + migrate ใหม่ทั้งหมด + seed อัตโนมัติตาม prisma.config.ts)
npm run db:migrate-legacy # ย้ายข้อมูลจากระบบ Laravel เดิม (F32)

npm run api:verify       # ตรวจสัญญา Public API (63 ข้อ)
npm run lint             # รัน ESLint
```

## การ Deploy และตั้งระบบครั้งแรก

ขั้นตอนเหมือนกันทุก platform ที่รันเป็น Docker — Dokploy, VPS + docker compose,
หรือเซิร์ฟเวอร์จริงของคณะ — เพราะสั่งทั้งหมดรัน**ใน container ของแอปเอง** (เปิดด้วย
`docker exec -it <container> sh` หรือปุ่ม terminal ที่ platform มีให้) image มีทั้ง source
และ dependencies ครบ (build ด้วย `npm ci` + `COPY . .`) และ env ที่ใส่ตอนรัน container
ถูกส่งถึงสคริปต์ทุกตัว สิ่งที่ต่างกันระหว่าง platform มีแค่วิธีใส่ env · วิธีเปิด terminal ·
ชั้น reverse proxy + TLS ด้านนอก container

**Environment ที่ต้องใส่ให้ container ก่อน:**

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `DATABASE_URL` | ชี้ไปที่ PostgreSQL ที่ container เข้าถึงได้ (ไม่มี container start ไม่ได้) |
| `BOOTSTRAP_ADMIN_EMAIL` · `BOOTSTRAP_ADMIN_PASSWORD` | บัญชี SUPERADMIN คนแรก (รหัส ≥ 12 ตัวอักษร) |
| `LEGACY_ORIGIN` | ที่อยู่ระบบเดิม — default `https://dev.nurse.cmu.ac.th/fonita` |

**ลำดับการทำงาน:**

```bash
# 1. schema — รันให้อัตโนมัติอยู่แล้วตอน container start (CMD ใน Dockerfile) ข้ามได้
npx prisma migrate deploy

# 2. สร้าง SUPERADMIN คนแรก (ครั้งเดียวต่อฐานข้อมูล)
npm run db:seed

# 3. ย้ายข้อมูลจากระบบเดิม — ดึงจาก Public API เส้นเดียว:
#      GET {LEGACY_ORIGIN}/api/v1/ita/{year}   วนปี 2565–2569
#    ไฟล์แนบดาวน์โหลดแยกต่างหากจากพาธ /storage/itafile ของระบบเดิม
npm run db:migrate-legacy -- --dry-run    # พรีวิวก่อน ไม่เขียนอะไร
npm run db:migrate-legacy                 # ย้ายจริง

# 4. ตรวจว่า API ของ deployment นี้ตอบตรงสัญญา — ต้องรันหลังขั้น 3 เท่านั้น
#    (ก่อนย้ายข้อมูล DB ว่าง API ตอบ [] จึงไม่มีอะไรให้ตรวจ)
VERIFY_ORIGIN=http://localhost:3008/fonita npm run api:verify
```

**ข้อควรระวัง:**

- **mount volume ถาวรที่ `/app/storage` ก่อนเริ่มขั้น 3** — ไฟล์จากระบบเดิมเขียนลง disk
  ของ container ถ้าไม่ mount ไว้ ไฟล์จะหายทุกครั้งที่ redeploy (DB ยังอยู่แต่ลิงก์ไฟล์ 404 ทั้งหมด)
- `db:migrate-legacy` ย้ายครั้งเดียวพอ — รันซ้ำจะโดน guard กันทับข้อมูล ต้องใช้ `--force`
  ถ้าต้องการลบปีเหล่านั้นแล้วย้ายใหม่ (ไฟล์ที่มีอยู่แล้วจะข้าม ไม่โหลดซ้ำ)
- การย้าย**ไม่รวมตาราง users** (D14) — เจ้าหน้าที่คนอื่นสร้างใหม่ผ่านหน้าจัดการผู้ใช้
- **เข้าใช้งานผ่าน HTTPS เท่านั้น** — session cookie ติดแฟล็ก `Secure` ใน production
  เปิดผ่าน `http://` ธรรมดา browser จะไม่เก็บ cookie → ล็อกอินได้แต่คลิกหน้าอื่นแล้วเด้งกลับ
  หน้า login ทุกครั้ง (ต้องมีโดเมน + TLS ปลายทาง — บนเซิร์ฟเวอร์จริงของคณะได้มาจาก
  reverse proxy ของหน่วย IT ซึ่งทำให้อยู่แล้ว)

## โครงสร้างโปรเจค

```
src/
├── app/                      # App Router (pages, layouts, route handlers)
│   ├── (auth)/               # หน้า login (ไม่มี shell)
│   ├── (app)/                # หน้าที่มี shell — รวมหน้าอ่านสาธารณะ (หน้าแรก, ดู ITA ตามปี)
│   ├── api/                  # Route Handlers — auth, Public API, YouTube proxy
│   ├── storage/              # ส่งไฟล์จากคลัง (นอก public/) ผ่าน route handler
│   └── {error,not-found,…}   # หน้า error ภาษาไทย (error, global-error, 403, 404)
├── actions/                  # Server Actions (ita, oit, file, user, profile, auth, …)
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── shell/                # โครงหน้า (header, sidebar, footer, theme)
│   ├── public/               # คอมโพเนนต์หน้าสาธารณะ (hero, ita-accordion, video)
│   ├── ita/ · files/ · users/ · misc/   # คอมโพเนนต์เฉพาะงาน
├── lib/
│   ├── auth/                 # session, scrypt, login rate limit, RBAC
│   ├── api/                  # ตัวแปลงร่างสำหรับ Public API (legacy compat) + rate limit
│   ├── files/ · ita/ · users/ · activity/ · youtube/
│   ├── prisma.ts             # Prisma client
│   └── date.ts · sanitize.ts · base-path.ts
└── proxy.ts                  # ป้องกัน route + RBAC ประตูแรก (Next.js 16 ใช้ proxy ไม่ใช่ middleware)

prisma/
├── schema.prisma             # schema ของฐานข้อมูล
├── migrations/               # migration SQL
├── seed.ts                   # ข้อมูลเริ่มต้น
└── migrate-legacy.ts         # สคริปต์ย้ายข้อมูลจากระบบ Laravel เดิม

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


## License

โค้ดส่วนที่เป็น internal ของคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ — ไม่เปิดเป็น open source
