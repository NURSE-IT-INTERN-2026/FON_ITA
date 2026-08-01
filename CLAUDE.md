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
- `docs/specs/spec.md` — complete technical spec (source of truth)
- `docs/specs/PRD.md` — product requirements (boss-facing)
- `docs/specs/status.md` — current development status
- `docs/chapters/00-overview.md` to `14-open-questions.md` — 15 chapter details
- `docs/chapters/05-public-api.md` — Public API contract (frozen, 100% compat with old Laravel)
- `docs/features/api-streaming.md` — optional streaming variant

---

## Phasing

See `docs/specs/status.md` for current status.

- **Phase 1 (foundation — DONE):** Next.js setup, CMU OAuth login/logout, basePath `/fonita`, env scaffolding
- **Phase 2 (in progress):** Prisma + PostgreSQL schema, server actions, UI migration from Lovable
- **Phase 3 (later):** Public API endpoints, streaming variant, production deploy + data migration from MySQL

**Dev setup:** `basePath: /fonita`, run with `npm run dev`. Default port per project config.

**OAuth credentials** will be in `.env.local` — NEVER read directly. Use `.env.example` as reference.

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

1. `docs/specs/spec.md` — full technical spec (source of truth)
2. `docs/specs/PRD.md` — product requirements
3. `docs/specs/status.md` — what's done vs not done
4. `docs/chapters/02-data-model.md` — Prisma schema (**PostgreSQL override** — use real `enum`, not String)
5. `docs/chapters/03-auth-rbac.md` — auth mechanism + RBAC matrix
6. `docs/chapters/04-features-routes.md` — route map (Laravel → Next.js)
7. `docs/chapters/05-public-api.md` — Public API contract (FROZEN)

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

## Lovable Reference

A Lovable-generated project (`fonita-loveableui/`) exists as **UI/design reference only**.

### What to use from Lovable
- UI structure, layout patterns, visual design, page behavior
- shadcn/ui primitives (already copied into `src/components/ui/`)
- Page layouts (in `fonita-loveableui/src/routes/`)

### What NEVER to copy from Lovable
- TanStack Router / TanStack Start (entry files, route definitions)
- Supabase Auth logic or client setup
- `src/lib/api.ts`, `src/lib/password.ts` (mock APIs)
- `src/mocks/*` (localStorage data)
- `lovable-error-reporting.ts`, `error-capture.ts`, `error-page.ts`
- Any data-fetching/routing/auth code

Convert Lovable pages into Next.js App Router manually. See `file-manifest.md` for the file-by-file action plan.
