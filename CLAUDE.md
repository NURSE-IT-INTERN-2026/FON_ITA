@AGENTS.md

# FON-ITA — Next.js App Router Project

## Security — Secrets

**NEVER read `.env` or any file containing real secrets** (CLIENT_SECRET, SESSION_SECRET, DATABASE_URL passwords, OAuth tokens, etc). When you need to know what environment variables are available, read `.env.example` instead. If the user asks you to check or fix env values, ask them to verify manually — do not read the file yourself.

## Project Overview

**FON-ITA** (ระบบจัดการข้อมูล ITA/OIT — Integrity & Transparency Assessment) is an internal system for **คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่** to manage and publicly publish yearly ITA data. Staff record ITA topics per year (พ.ศ.); each ITA has OIT sub-items (title + link + rich text content). A central file library and a **Public API** feed the faculty's main website.

**System being replaced:** Laravel 8 / PHP 7.4 + MySQL — being migrated to Next.js 16 + PostgreSQL. Feature parity required (every page + endpoint from the old system must have an equivalent).

**4 user groups:** Public (no login), USER, ADMIN, SUPERADMIN. **Two login channels**: (1) CMU OAuth (Microsoft Entra ID) SSO and (2) email + password (form login, hashed with scrypt). Both produce the same opaque-token session.

**Deployment target:** Mount under `/fonita` of faculty domain (`https://service.nurse.cmu.ac.th/fonita`). Reverse proxy managed by ops team.

Full specs in `docs/`:
- **`docs/rules/decisions.md` — decision log (D1–D10). Wins over every other doc when they conflict.**
- `docs/specs/spec.md` — complete technical spec
- `docs/specs/_features.md` — live feature tracker (F1–F33)
- `docs/specs/PRD.md` — product requirements (boss-facing)
- `docs/specs/status.md` — current development status
- `docs/chapters/00-overview.md` to `14-open-questions.md` — 15 chapter details
- `docs/chapters/05-public-api.md` — Public API contract (frozen, 100% compat with old Laravel)
- `docs/features/api-streaming.md` — optional streaming variant

Doc precedence when they disagree:
`CLAUDE.md` / `AGENTS.md` → `docs/rules/decisions.md` → `docs/rules/*` → `docs/specs/` → `docs/chapters/`

`specs/spec.md` and `chapters/` were written first and still lag in places — every conflict found so
far is resolved in `decisions.md`.

---

## Phasing

`docs/specs/_features.md` is the live feature tracker (F1–F33) — check it before starting work.
`docs/specs/status.md` has the narrative status.

Actual state (verify against the tracker rather than trusting this list):

- **F1–F4 — DONE:** Prisma + PostgreSQL schema · `basePath: /fonita` + env · shell layout
  (header/sidebar/footer/theme) · design tokens + 17 shadcn primitives
- **F30 — partial:** `src/lib/date.ts` exists; not every date surface uses it yet
- **Phase 2 (auth, F5–F12), Phase 3–5 (ITA/OIT, files, users), Phase 6 (Public API):** not started

`src/app/(app)/layout.tsx` calls a `getShellUser()` stub that returns `null` — swap it for
`getSessionUser()` when F5/F11 land. Nothing is mocked, so the shell currently renders its
signed-out form.

**Dev setup:**
```bash
npm run db:up      # Postgres 16 in Docker (container `fonita-pg`)
npm run dev
```

**`.env.local` holds real secrets — NEVER read it.** Use `.env.example` as the reference for what
variables exist. If env values need checking or fixing, ask the user to do it manually.

---

## MANDATORY — Read Before Every Code Change

**STOP. Do NOT write any code until you have completed the steps below.**

### Step 1: Read relevant skills

Read the SKILL.md files for every topic that applies to your task:

| If your task involves... | Read this skill first |
|---|---|
| ANY Next.js code (routes, pages, layouts, components) | `.agents/skills/next-best-practices/SKILL.md` |
| Redirects, navigation, URL matching, proxy, basePath | `.agents/skills/basepath-handling/SKILL.md` |
| Implementing a new feature or modifying an existing one | `.agents/skills/implement-feature/SKILL.md` |
| CMU OAuth login, token exchange, user info | `.agents/skills/cmu-oauth-integration/SKILL.md` |
| Opaque token session, scrypt password, RBAC helpers | `.agents/skills/custom-auth/SKILL.md` |
| Finishing a feature (before marking done) | `.agents/skills/review-feature/SKILL.md` |

### Step 2: Read project docs

0. **`docs/rules/decisions.md` — read FIRST. Overrides anything below it that disagrees.**
1. `docs/specs/spec.md` — full technical spec
2. `docs/specs/_features.md` — feature tracker; find the F-number you are implementing
3. `docs/specs/status.md` — what's done vs not done
4. `docs/specs/PRD.md` — product requirements
5. `docs/chapters/02-data-model.md` — Prisma schema (**PostgreSQL** — real `enum`, not String)
6. `docs/chapters/03-auth-rbac.md` — auth mechanism + RBAC matrix
7. `docs/chapters/04-features-routes.md` — route map (Laravel → Next.js)
8. `docs/chapters/05-public-api.md` — Public API contract (FROZEN)

> **Skills describe reusable technique and are deliberately project-agnostic** — they carry no
> FON-ITA names, roles, paths, or defaults. Everything specific to this project lives here and in
> `docs/`. Where a skill shows a placeholder (`<base>`, `OWNER`/`STAFF`/`MEMBER`, `/dashboard`),
> substitute the real value from `docs/rules/decisions.md` and `docs/rules/route-map.md`.
>
> FON-ITA's own answers to the choices `custom-auth` asks about — opaque token + DB session, scrypt,
> `AppRole`, cookie `path=/fonita`, OAuth with `state` and no PKCE, no auto-provisioning — are in
> `docs/rules/adapt-custom-auth-skill.md`.

### Step 3: Read existing code

Before changing a file, READ IT FIRST. Understand what exists before modifying.

### Step 4: Summarize plan to user

Tell the user what files you will change and why. Wait for confirmation before implementing.

**Only after completing ALL steps above, start writing code.**

---

## Architecture Rules

- Use Next.js App Router (`src/app/` directory). No `pages/` directory.
- Use `proxy.ts` for route protection and RBAC — **not** `middleware.ts`.
- **Custom auth with `node:crypto` only** — **NO auth libraries** (no Auth.js/Lucia/NextAuth). Opaque token + DB Session (SHA-256 of token stored as `Session.id`). Password = scrypt.
- **Two login channels, both via custom implementation (no library):** (1) CMU OAuth (Microsoft Entra ID) SSO, (2) email + password form login (scrypt-hashed). Both create the same opaque-token session.
- **PostgreSQL + Prisma** for all data. (Overrides the SQLite mentioned in some older docs — see `docs/rules/tech-stack.md`.)
- **Zod** validation at every Server Action + Route Handler boundary.
- Server Components by default. Client Components only when hooks/event handlers are needed (Tiptap editor, modals, live search, drag-and-drop).
- **Tiptap** for rich text — `'use client'`, 1000-char limit, sanitize HTML on save AND display (DOMPurify).
- **Files stored outside `public/`**, served via route handler. Filename renamed to Unix timestamp on upload. Path traversal prevention mandatory.
- Keep changes minimal and focused. No speculative features.
- Do not add dependencies unless necessary and justified.
- Enforce RBAC at **both** proxy (first gate) AND Server Action (real decision) — never trust UI.

### Public API Compatibility (CRITICAL)

- **`GET /api/v1/ita/{year}`** — must return `snake_case` JSON matching the old Laravel response exactly. Eager-load `oits`. Rate limit 300/min.
- **`GET /api/nurse/youtube-feed`** — proxy YouTube RSS + CORS headers.
- **DO NOT change field names, case, or response shape** — the faculty website consumes these. See `docs/chapters/05-public-api.md`.
- Path: `/fonita/api/...` (consumer calls with basePath — no `rewrites`).

---

## Language

- All user-facing text in **Thai** (ภาษาไทย): page headings, labels, button text, placeholders, error messages, toast messages, empty states, validation messages, navigation.
- Enum values in DB/code remain in English. Only display labels are Thai.
- Code comments, variable names, file names, commit messages remain in English.
- Default `locale = th`, `timezone = Asia/Bangkok`.
- **Buddhist year (พ.ศ.)**: Use `lib/date.ts` helpers — `toBE(year)`, `currentBEYear()`. NEVER inline `+543` in components.

### Thai Role/Status Labels

| Enum Value | Thai Label |
|---|---|
| **AppRole** | |
| `SUPERADMIN` | ผู้ดูแลสูงสุด |
| `ADMIN` | เจ้าหน้าที่ |
| `USER` | ผู้ใช้ทั่วไป |
| **User status** | |
| `true` (active) | ใช้งานได้ |
| `false` (disabled) | ปิดใช้งาน |

---

## Workflow — Complete Feature Cycle

For every feature the user asks you to implement:

```
1. READ SKILLS → 2. READ DOCS → 3. READ CODE → 4. PLAN → 5. IMPLEMENT → 6. REVIEW → 7. UPDATE DOCS
```

1. **Read skills** — Follow "MANDATORY — Read Before Every Code Change" above
2. **Read docs** — `spec.md`, `PRD.md`, `status.md`, plus the relevant chapter
3. **Read existing code** — Read files you will modify before changing them
4. **Summarize plan** — Tell the user what files will change, get confirmation
5. **Implement** — Write the vertical slice
6. **Review** — Run the `review-feature` checklist
7. **Update docs** — Update `docs/specs/status.md` to reflect completion
8. **Report** — Tell the user the review result

**Do NOT skip steps 1-4. Do NOT implement without reading skills first. Do NOT mark complete without running the review.**

---

## `_to-migrate/` — staging area

Source material still waiting to be ported lives in **`_to-migrate/`**, grouped by destination:

```
_to-migrate/01-lib/                    api, date, file, sanitize, utils, password (6)
_to-migrate/02-components-feature/     feature + misc components (20)
_to-migrate/03-routes-tanstack/        TanStack page code — structure reference only (14)
_to-migrate/04-mocks-optional/         localStorage mocks — DO NOT port (2)
_to-migrate/05-error-handling-maybe-drop/  Lovable-specific — DO NOT port (3)
```

`_to-migrate/` is excluded from `tsconfig.json` and ESLint, and gitignored. It is **staging, not app
code** — nothing there runs until it is moved into `src/`. Delete the folder once everything is moved.
`_migration/` holds only leftover config templates plus `install-packages.sh`, whose header tracks
which npm packages each feature still needs.

**The CMU auth code is NOT in this repo.** It lives in the earlier Next.js attempt at
`fon_public_data/src/{lib/auth,app/api/auth,app/(auth)/login}` — read it from there when doing F5–F9.

**Follow `docs/migration/file-manifest.md`** — it marks each file ✅ copy / 🟡 convert / 🔴 rewrite.

### Must be rewritten, not copied (🔴)
- `fon_public_data/src/lib/auth/session.ts` — implements **JWT/HMAC**, which violates the opaque-token +
  DB Session rule (`docs/rules/decisions.md` D2)
- `fon_public_data/src/app/api/auth/callback/route.ts` — signs a session straight from CMU basicinfo
  **without matching a `users` row or checking `status`**, which would let any CMU account in (D6)

### Never bring across
- TanStack Router / TanStack Start, Supabase client or auth
- `lib/api.ts`, `lib/password.ts` (mock), `mocks/*` (localStorage)
- `lovable-error-reporting.ts`, `error-capture.ts`, `error-page.ts`

Convert pages into App Router manually — use the old layouts for visual reference only.
