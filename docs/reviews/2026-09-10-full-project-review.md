# FON-ITA — Full-project review (2026-09-10)

Method: code-review-and-quality skill, five axes. The repo (~150 files, ~17k lines) was split into 6 slices and
reviewed in parallel: auth · actions & data · public surface · files & editor · admin UI · ops. I re-read the source
myself for every **Critical** and **Required** item; those are marked ✓. Consider, Nit and FYI items were
reported by the slice reviewers and spot-checked only where marked ✓.

**Scope:** deployment with Docker (`Dockerfile`, `.dockerignore`, image/runtime setup) is out of scope for this
report.

**Verdict: Request changes.** No finding needs an emergency hotfix. One Critical bug is triggered by normal
use, and several Required issues touch authentication and the upload/delete workflows.

---

## 1. Baseline

| Check | Result |
|---|---|
| `npm run lint` | ✅ pass (exit 0) |
| `npm audit` (prod + dev) | ✅ `found 0 vulnerabilities` |
| `npx tsc --noEmit` | ⚠️ inconclusive: all 38 errors come from `src/generated/prisma` never being generated (`Cannot find module '@/generated/prisma/enums'`) plus a missing `next-env.d.ts` (image imports). Run `npm run db:generate` + `next dev` once, then re-run. |
| `npm run api:verify -- --offline` | ⚠️ inconclusive: port 3000 is held by another node process (PID 33920), which returns HTML 404 for `/fonita/*`. The script never reached this app. |

There are no tests (known; see CLAUDE.md), and the build was not run.

---

## 2. Critical

### C1 ✓ Creating two users in a row silently gives the second one the first one's password
[user-form-dialog.tsx:199,222,390](../../src/components/users/user-form-dialog.tsx#L199)
- **Cause:** `password` state sits *above* the keyed `<form>`. Only the Radix `onOpenChange` wrapper (L230-238) resets it.
- **What bypasses the reset:** the success path (`onOpenChange(false)`, L222) and Cancel (L390) call the parent's `setOpen` directly, so no reset runs.
- **Why the state survives:** `UserCreateButton` keeps the dialog mounted (L49).
- **Scenario:** SUPERADMIN creates user A with password P and then creates user B without opening the password section.
- **Result:**
  - The collapsed `<details>` still submits `password=P`, plus `mustReset` (`defaultChecked`). B gets a password login it was never meant to have, and the password is one the SUPERADMIN already knows.
  - In edit mode, reopening a row re-sends the last password. That re-hashes it, revokes all of that user's sessions, and writes another log entry.
- **Fix:**
  - Move the form state into an inner `<UserForm>` that mounts only while `open` is true (e.g. `{open && …}` or `key={openCount}`). This deletes the manual reset block.
  - At minimum, route success and Cancel through one `close()` that resets.
- The same pattern causes R7 (picker Cancel) and the `ita-manage` Cancel bug under Consider.

---

## 3. Required

### Security / auth

**R1 ✓ The login rate limit can be bypassed with a forged `X-Forwarded-For`**
[login-rate-limit.ts:9-26](../../src/lib/auth/login-rate-limit.ts#L9)
- **Cause:** the IP is the left-most XFF entry, which the client controls because nginx appends to the header. The per-identity bucket is keyed on `${ip}:${email}`.
- **Scenario:** a random XFF value on each attempt gets a fresh bucket for both limits, so one account can be guessed against without limit.
- **Reverse case:** with no proxy header, everyone shares `"unknown"`, and 10 bad attempts lock out password login for everyone.
- **Fix:**
  - Take the IP from the hop your proxy appends: the right-most entry, or `x-real-ip` set by nginx.
  - Key the identity bucket on the email alone.
  - Add a hard cap with eviction to the in-memory store; `login-rate-limit-provider.ts:46` has the same full-scan prune problem as R-public below.

**R2 ✓ CMU OAuth account matching uses `ILIKE`, so `_` and `%` act as wildcards**
[callback/route.ts:64-66](../../src/app/api/auth/callback/route.ts#L64)
- **Code:** `findFirst({ where: { cmuAccount: { equals: cmuAccount, mode: "insensitive" } } })`.
- **Evidence:** I decoded Prisma 7's Postgres query compiler (`query_compiler_fast_bg.postgresql.wasm-base64.js`). It contains `ILIKE` / `NOT ILIKE` and no `LOWER(`, so case-insensitive `equals` compiles to `ILIKE`.
- **Scenario:** a CMU account `som_hai` matches row `somchai` and signs in as that user with that user's role. `findFirst` also picks arbitrarily between `Foo` and `foo`.
- **Fix:** new rows are already lowercase (`user.ts` lowercases the email, `resolveCmuAccount` lowercases). Lowercase the old rows once, then use `findUnique({ where: { cmuAccount } })`. Stopgap: `escapeLike(cmuAccount)`.
- **Related:** [seed.ts:54](../../prisma/seed.ts#L54) derives `cmuAccount` from *any* bootstrap email ✓. `admin@gmail.com` gives SUPERADMIN `cmuAccount = "admin"`, which the CMU user `admin` would then match. Derive it only for `@cmu.ac.th`.

**R3 ✓ The OAuth callback doesn't catch errors from the network or the DB**
[callback/route.ts:49-75](../../src/app/api/auth/callback/route.ts#L49)
- **Cause:** `exchangeCodeForToken`, `fetchCmuBasicInfo`, `res.json()`, `findFirst` and `createSession` can all throw, and nothing wraps them.
- **Result:** a DNS/TLS error, a non-JSON body or a DB blip becomes a raw 500 instead of `/login?error=…`. The CMU fetches also have no `AbortSignal.timeout`.
- **Fix:** wrap in try/catch that ends in `failed(request, LoginError.Generic)`, and add `signal: AbortSignal.timeout(10_000)` to both fetches.

**R4 ✓ `seed-test-users` can run against production**
[prisma/seed-test-users.ts](../../prisma/seed-test-users.ts)
- **What it creates:** up to 30 active **ADMIN** accounts with the in-repo password `FonitaTest2569!`. It has no NODE_ENV, host or confirmation guard, and it prints the password.
- **Why production is exposed:** it is an ordinary npm script next to `db:seed`. One run with the production `DATABASE_URL` loaded creates the accounts.
- **Fix:** refuse unless `NODE_ENV !== "production"` and the DB host is localhost, or require an explicit flag.

### Correctness: files & editor

**R5 ✓ The file-reference warning misses real references** (my finding, extended by 3 reviewers)
[files/queries.ts:127-132](../../src/lib/files/queries.ts#L127)
- **Encoding mismatch:** content holds `fileUrl(path)`, which is `encodeURIComponent`-encoded ([tiptap-editor.tsx:292](../../src/components/ita/tiptap-editor.tsx#L292), [file-picker-dialog.tsx:147](../../src/components/files/file-picker-dialog.tsx#L147), and `migrate-legacy.ts:273`). The migration stores the **decoded** legacy name in `path` (`migrate-legacy.ts:228`), and the query matches the raw `path`. So a legacy name with Thai text or spaces never matches.
- **Wrong column:** only `content` is searched. `Oit.link` is exactly where `FileCopyUrlButton`'s URL gets pasted.
- **No escaping:** `escapeLike` is missing, so `_` in legacy names over-matches.
- **Scenario:** the dialog says the file is unreferenced, the user deletes it, and a public OIT link now returns 404.
- **Fix:** `const needle = escapeLike(\`/storage/itafile/${encodeURIComponent(path)}\`)` and `where: { OR: [{ content: { contains: needle } }, { link: { contains: needle } }] }`. Also correct the doc comment.
- **Related, in the delete button** ([file-delete-button.tsx:74-109](../../src/components/files/file-delete-button.tsx#L74)) ✓: "ลบ" is enabled while `references === null`, and a fetch error is treated as "none". Disable the button until references load, and show a "couldn't check" message on error.

**R6 ✓ Dropping a file on the picker's inline uploader never uploads it**
[file-picker-dialog.tsx:382-386 vs 179](../../src/components/files/file-picker-dialog.tsx#L179)
- **Cause:** `onDrop` only sets `uploadFileObj` state, but `submitUpload` builds `new FormData(event.currentTarget)` from the `<input name="file">`, which a drop never fills.
- **Result:** the server answers "กรุณาเลือกไฟล์". If the user picked A first and then dropped B, **A is uploaded under B's name**.
- **Fix:** `formData.set("file", uploadFileObj)` and `formData.set("name", …)` from state, as `FileUploader.submit` already does.

**R7 ✓ The picker's Cancel skips `reset()`, so reopening inserts the stale file**
[file-picker-dialog.tsx:448](../../src/components/files/file-picker-dialog.tsx#L448)
- **Cause:** Cancel calls `onOpenChange(false)` directly (the same pattern as C1), so the wrapper at L216-219 never runs.
- **Result:** reopening lands on step 2 with the old file and label, ignoring the new text selection.
- **Fix:** one `close()` function used by both paths.

**R8 ✓ The editor lets users create blocks that the sanitizer removes on save**
[tiptap-editor.tsx:100-102](../../src/components/ita/tiptap-editor.tsx#L100) vs [sanitize.ts:12-30](../../src/lib/sanitize.ts#L12)
- **Cause:** `StarterKit.configure({ link: false })` leaves Heading, Blockquote, Code, CodeBlock and HorizontalRule enabled, but `ALLOWED_TAGS` has no `h1-6`/`blockquote`/`pre`/`code`/`hr`. `TextAlign` even targets `"heading"`.
- **Scenario:** typing `## ` or pasting from Word shows a heading. It is flattened on save, so the published page differs from what the editor showed.
- **Fix:** disable those extensions (and set `TextAlign types: ["paragraph"]`), or allow the tags.

### Correctness: public surface (frozen API)

**R9 ✓ Topic order has no tiebreaker, so the Public API output isn't deterministic**
- **Where:**
  - [legacy-ita.ts:106](../../src/lib/api/legacy-ita.ts#L106), [stream/route.ts:63](../../src/app/api/v1/ita/[year]/stream/route.ts#L63), [ita/queries.ts:73](../../src/lib/ita/queries.ts#L73): `orderBy: { order: "asc" }` only.
  - [ita.ts:58-65,81](../../src/actions/ita.ts#L58): `nextOrder()` reads the max outside a transaction. The move-year transaction runs at READ COMMITTED, so it doesn't prevent the race either.
- **Scenario:** two concurrent creates get the same `order`. After that, Postgres can return the pair in either order on each request, and stream and plain responses can disagree.
- **Fix:**
  - Use `orderBy: [{ order: "asc" }, { id: "asc" }]` in all three queries; the shape is unchanged, but run `api:verify`.
  - Optionally take `pg_advisory_xact_lock(hashtext(year))` around the `nextOrder` + write.

**R10 ✓ A mid-stream failure looks like a successful, shorter year**
[stream/route.ts:82-89](../../src/app/api/v1/ita/[year]/stream/route.ts#L82)
- **Cause:** `catch` logs, then `finally { controller.close() }` ends the stream normally.
- **Result:** the consumer renders 5 of 12 topics as the full year.
- **Fix:** `controller.error(error)` in the catch, and `close()` only on success.

**R11 ✓ The landing page's "ลองใหม่อีกครั้ง" (retry) does nothing**
[ita-search-section.tsx:209](../../src/components/public/ita-search-section.tsx#L209)
- **Cause:** it calls `router.refresh()`, but the fetch effect depends only on `[target]` and client state is preserved, so the effect never re-runs.
- **Fix:** add a `retry` counter to the effect's dependencies (resetting status to loading), or remount the section with a `key`.

### Admin UI

**R12 ✓ Keyboard reordering is announced but not wired up**
[ita-sortable-list.tsx:77-78](../../src/components/ita/ita-sortable-list.tsx#L77)
- **Cause:** only `PointerSensor` is registered, yet the screen-reader instructions say "กด Space … ใช้ปุ่มลูกศร" (press Space, use the arrow keys). Drag-and-drop is the *only* way to reorder.
- **Also:** the announcements (L42-46) read the DB id as "ลำดับที่" (position number).
- **Fix:** `useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })`, and announce the item's index + 1.

### Ops

**R13 ✓ Uploads near 10 MB are cut off before the Server Action runs**
[next.config.ts:37](../../next.config.ts#L37)
- **Cause:** Next 16.3.4 defaults `experimental.proxyClientMaxBodySize` to `10485760` (`config-shared.js:279`). Because `proxy.ts` exists, `resolve-routes.js:124` clones the body with that limit and keeps only the first 10 MB.
- **Result:** a 9.9 MB file plus multipart framing arrives truncated, and the user gets the generic "upload failed" error. `bodySizeLimit: "11mb"` alone doesn't help.
- **Fix:** add `proxyClientMaxBodySize: "11mb"`, ideally derived from `MAX_FILE_SIZE_BYTES`, then test with a 9.9 MB file.

**R14 ✓ Prisma CLI and runtime client versions differ**
[package.json](../../package.json)
- **Versions:** `prisma` is 7.10.0, while `@prisma/client` and `@prisma/adapter-pg` are 7.9.1. `prisma generate` runs the 7.10 generator while the app loads the 7.9.1 runtime, and Prisma requires them to match exactly.
- **Fix:** pin all three to one exact version and regenerate the lockfile.

---

## 4. Consider

**Auth & users**
- **Last-SUPERADMIN guard race** ([user.ts:101-107](../../src/actions/user.ts#L101) ✓). The count check and the write are separate, so two SUPERADMINs disabling or demoting each other at the same moment leaves zero. Fix: an advisory lock plus re-count inside a transaction.
- **`updateUser` accepts `USER` for any target** ([user.ts:69](../../src/actions/user.ts#L69) ✓), although the comments and UI allow it only for existing USER rows. Fix: reject when `role === "USER" && target.role !== "USER"`.
- **`/login?error=__proto__` crashes the login page** ([login/page.tsx:31](../../src/app/(auth)/login/page.tsx#L31) ✓). The lookup returns an object, which passes `{message && …}` and then throws in React. Fix: `Object.hasOwn`.
- **Login timing reveals CMU-only accounts** (`password.ts:38-41`, `auth.ts:60-68`). A `password: null` account returns without scrypt work. Also, the login password field has no `.max()`.
- **Cross-site forced logout.** `clearSession()` sends the cookie deletion even when no token arrived. Fix: delete the cookie only when a token was present.
- **scrypt parameters.** Node's default cost is N=16384, and the `salt:hash` format stores no parameters. Fix: a versioned format.
- **No PKCE** on the Entra flow.
- **Nav, prefixes and page roles disagree.**
  - `/activity-log` is in `ADMIN_PREFIXES` (`roles.ts:35`) but the page is SUPERADMIN-only.
  - The profile menu is shown to legacy USER accounts, but the profile page requires ADMIN+.

**Data & actions**
- **`reorderIta` never validates the id list** ([ita.ts:200-204](../../src/actions/ita.ts#L200) ✓). A partial or duplicated list is silently applied and logged. Fix: require set-equality with the year's ids.
- **`uploadFile` undo can delete a saved file** ([file.ts:65-96](../../src/actions/file.ts#L65) ✓). The undo try also wraps `logActivity` / `revalidatePath`, so a throw there unlinks the bytes of a committed row. Fix: wrap only `create`.
- **`saveUpload` leaves partial writes** (`storage.ts:119`). A write that fails midway (ENOSPC) is orphaned; unlink it on error.
- **A bad env value silently disables a limit.** `MAX_FILE_SIZE_BYTES` or `PUBLIC_API_RATE_LIMIT_PER_MIN` set to `NaN` turns off its check. Fix: parse with a fallback.
- **The activity log scans the whole table on every page view.** `countByAction` + `distinct actorId` do this, and there is no `(actorId, createdAt)` index.

**Public surface**
- **Public API rate limiter** ([rate-limit.ts:46,93](../../src/lib/api/rate-limit.ts#L46) ✓):
  - Pruning does a full-Map scan once size exceeds 5,000 and never evicts live buckets.
  - The key is the spoofable left-most XFF entry.
  - Fix: add a hard cap with oldest-first eviction.
- **Malformed `%` → 500.** `decodeURIComponent` in the storage route ([route.ts:29](../../src/app/storage/itafile/[file]/route.ts#L29) ✓) throws `URIError` on it. Catch it and return 404, or validate the name shape first.
- **`/ita-oit/0x10`** renders OIT 16, and `/ita-oit/99999999999` gives a Prisma out-of-range 500 ([page.tsx:18](../../src/app/(app)/ita-oit/[id]/page.tsx#L18) ✓). `getOit` also runs twice per request. Fix: `^[1-9]\d{0,9}$` plus React `cache()`.
- **Sanitizer allows `class`** ([sanitize.ts:38](../../src/lib/sanitize.ts#L38) ✓). That re-opens the overlay trick the style hook blocks (`class="fixed inset-0 z-50"`). The editor never writes `class`, so drop it.
- **Migrated `link` values skip the http(s) check** (`migrate-legacy.ts:446` ✓). They then reach `window.open(oit.link)` ([ita-accordion.tsx:77](../../src/components/public/ita-accordion.tsx#L77) ✓). Validate on import and before `window.open`.
- **Client disconnect mid-stream** logs a false error and double-closes. Moving to `pull()`/`cancel()` gives backpressure too.

**Files & editor UX**
- **Picker search can land after `reset()`** and repopulate stale results. Also, the debounce timer is never cleared.
- **`FileSearchInput` goes stale.** It doesn't resync on Back, and a pending timer can yank the user back after they navigate away. Fix: `key={search}`, cleanup, `router.replace`.
- **Editor drag-and-drop:**
  - Only the first file of a drop is used.
  - The drop position goes stale during upload.
  - Save isn't blocked while an upload is pending.
- **Keyboard and naming:** drop zones aren't keyboard-reachable (`div onClick` + `hidden` input), and the Tiptap editor has no accessible name (`oit-form.tsx:135` label has no target).
- **Picker label is dropped:** when text is selected, the label typed in step 2 is ignored.
- **Structural: upload logic duplicated 3×.** FileUploader, the picker and the editor drop each have their own copy, and they have already drifted; R6 is the drift. Extract `useUploadDraft()` and `deriveDisplayName()`, plus a `<FileDropZone>` that owns the keyboard fix. This also splits `file-picker-dialog.tsx` (460 lines) cleanly.

**Admin UI**
- **Activity-log page:**
  - `?from=2026-13-45` gives Invalid Date → Prisma throws → 500 ([activity-log/page.tsx:34-48](../../src/app/(app)/activity-log/page.tsx#L34) ✓), and `?actor=99999999999` overflows int4. Validate that dates round-trip and cap the id.
  - Its date inputs have no labels.
  - The custom actor picker has no Escape handling or focus management; build it on `DropdownMenu`.
  - Changing one date drops the other when the month default is active.
- **`ita-manage` dialogs:** Cancel skips the error reset (C1 pattern), and every card's icon buttons share the same `aria-label`.
- **User form, edit mode:** the password section is offered for CMU-only accounts, where the action always rejects.
- **Error pages:** `forbidden` / `error` / `not-found` have no `<main>` landmark, and comments disagree about whether the shell persists.

**Ops & tooling**
- **`migrate-legacy.ts --force`:**
  - It deletes before minutes of downloads, with no transaction or confirmation, so the public API serves empty years in the meantime.
  - `storedName` from legacy HTML is joined into a write path without a containment check (L393).
- **`api:verify`:**
  - "63 checks" holds only for `--offline` (119 online).
  - `title`/`content` types and `ita_id === String(parent.id)` are unchecked.
  - A JSON parse error throws instead of counting as a failure.
- **Version drift:**
  - `eslint-config-next` 16.2.12 vs `next` 16.3.4.
  - No `engines`, but Prisma 7.10 needs Node ≥20.19/22.12 while the README says 20+.
  - The `overrides` (deepmerge-ts, mysql2) have no explanation.

---

## 5. Nit

- **Stale comments after the D26 hard-delete removal** ✓:
  - [files/queries.ts:12-14](../../src/lib/files/queries.ts#L12)
  - [file.ts:69-70](../../src/actions/file.ts#L69)
  - `schema.prisma:143-144`
  - `schema.prisma:110` ("swapped pairwise on update": wrong)
- **Other stale comments:**
  - `mustResetPassword` "legacy bcrypt" origin (`callback/route.ts:71`, `schema.prisma:56`)
  - `getPublicItasByYear` (ita-accordion)
  - sanitize "server-side only"
  - storage route "plain filename fallback"
  - youtube feed "home page renders"
  - `unauthorized.tsx:13`
  - `user.ts:309` tabs
  - `tiptap-editor.tsx:68` `FileUploadDialog`
  - `autoName` "null once user types"
  - `ita-list-view` "plain text chips"
- [user-form-dialog.tsx:247-251](../../src/components/users/user-form-dialog.tsx#L247) ✓ renders an empty `DialogDescription` in create mode.
- **English errors, and one crash, on hand-built requests.**
  - With a field missing from FormData, `formData.get()` returns `null` and Zod reports its default English message.
  - In `user.ts:111`, `(formData.get("prefix") as string).trim()` ✓ throws outside the try if a File is posted.
- **`user.ts` small issues:**
  - The P2002 message always blames the email, even when `cmuAccount` clashed.
  - `disableUser` on an already-disabled SUPERADMIN hits the last-SUPERADMIN guard.
  - A SUPERADMIN setting their own password via user management revokes their current session.
- **`getSessionLoginMethod()`** duplicates `user.loginMethod` (an extra DB query).
- **Hard-coded values:**
  - `session-cookie.ts` hard-codes `/fonita` again, and SameSite is unvalidated.
  - `reset-password-form` hard-codes `minLength={8}`.
- **`/public-api` docs page:** the timestamp example has 3 decimals (the contract uses 6), and "60 คำขอต่อนาที" (60 requests per minute) is hard-coded.
- **Small editor/uploader bugs:**
  - One bad `&#99999999;` entity empties the whole YouTube feed.
  - `applyLink` turns `mailto:` or `/fonita/…` into `https://…`.
  - Typing after an inserted file link extends the link (Link `inclusive`).
  - Rejecting an oversized file keeps the previous file selected.
  - The OIT form's char count starts at 0, so a legacy row over 1000 characters can be submitted without the counter blocking it.
- **Unlabelled switch:** `user-status-switch` uses a label that flips with the action instead of naming the state.
- **Docs and config drift:**
  - README asks for `SESSION_SECRET` (unused).
  - README claims `db:reset` auto-seeds.
  - README omits `db:seed-test-users` / `db:migrate:deploy`.
  - `.env.example` is missing `LEGACY_ORIGIN`, `VERIFY_ORIGIN`, `BOOTSTRAP_ADMIN_FORCE`, `TEST_USERS_COUNT`, and it sets `NODE_ENV`.
- **`next.config.ts`:** no `poweredByHeader: false`, and `allowedDevOrigins` hard-codes a LAN IP.
- **`migrate-legacy.ts --dry-run`** skips the existing-rows guard, so a dry run passes and the real run then fails.

---

## 6. FYI

- **Commit c0fef8b:** the message "Implement feature X to enhance user experience…" describes a lockfile-only patch bump: next 16.3.0→16.3.4, sharp 0.35.3→0.35.4, @swc/helpers, js-yaml 4.3.2. No major bumps and no new packages. Only the message is wrong, and history does not need rewriting.
- **`revalidatePath` gaps:** some exist (`/ita-oit/[id]` after an ITA rename, `/activity-log`, `/profile`), but every affected page is dynamic (cookies) and `/` loads via the browser, so no stale data today.
- **Not yet an issue:**
  - Rate limits are per-process, which is fine for one instance.
  - The stream has no consistent snapshot.
  - Prisma stores milliseconds, so new timestamps end in `.123000Z`; the format check still passes.
- **Server Actions behind a proxy:** `serverActions.allowedOrigins` is unset. If the reverse proxy rewrites `Host` without `X-Forwarded-Host`, every action will be rejected. Check the deploy.
- **Uploaded content:** file contents aren't signature-checked. The risk is low (only ADMINs can upload, types come from the stored extension, plus nosniff and a CSP), but a magic-byte check is cheap.
- **`noUncheckedIndexedAccess`** is off.

---

## 7. Invariant sweep (CLAUDE.md)

| # | Invariant | Result |
|---|---|---|
| 1 | Every Server Action re-checks the role | ✅ clean: all 22 exports in `src/actions/*` (`authenticate` and `resetPassword` are the intended exceptions) |
| 2 | `contains:` wrapped in `escapeLike` | ❌ `files/queries.ts:129` (R5). The activity and file-name searches are fine |
| 3 | `dangerouslySetInnerHTML` fed by `sanitizeHtml` | ✅ both sites (`ita-oit/[id]`, `ita-accordion` via `public-api.ts`) |
| 4 | basePath on `<a>`, `fetch`, cookie path, `NextResponse.redirect` | ✅ clean (one duplicate default in `session-cookie.ts`, Nit) |
| 5 | No client import of prisma/storage/session | ✅ clean |
| 6 | `revalidatePath` coverage | ✅ no stale views today (see FYI) |
| 7 | `logActivity` on every mutation, key exists | ✅ clean (`user.delete` label stays for historical rows; add a comment) |
| 8 | Proxy whitelist ↔ route tree | ⚠️ matches, except the dead `/cmu-mobile` prefix, a pre-opened public path with no route |
| 9 | Zod at route boundaries / no error leaks | ⚠️ storage route `URIError`, activity-log dates, OIT id parse (Consider) |

---

## 8. Dead code identified (not deleted — confirm first)

- `"/cmu-mobile"` in `PUBLIC_PREFIXES` (`proxy.ts:42`), and the env vars `CMUMOBILE_TOKEN` and `SESSION_SECRET`
- The `@radix-ui/react-tooltip` dependency (0 imports)
- `WarmMetricCard`, `WarmMetricLabel`, `WarmMetricValue`, `WarmIconChip` and `warmMetricCardClass` in `shell/surfaces.tsx` (orphaned when b361d5f removed the metric cards)
- The `canManage` prop chain in `ItaListView` → `ItaSortableList` → `ItaCard` (both callers pass `true`), plus its false branches
- `OitDetail` type (`ita/queries.ts:60`)
- `ItaAccordionEntry.year` and `.order`
- Unused component props and fields:
  - `OitDeleteButton` `size` / `iconOnly`
  - `ItaCreateButton` `variant` / `className`
  - `EditableIta.order`
- `getSessionLoginMethod()` (`session.ts:139`)
- The unreachable `EmptyState` branch on the user-management page
- `listManagedUsers` fields `cmuAccount`, `createdAt` and `total` (never read)
- An unreachable try/catch in `password.ts:45-50`
- The `retryAfterSeconds` and `ipKey` return fields in `consumeLoginRateLimit` (never read)
- (Low value) Many types and constants are exported but only used locally, e.g. `FILES_PER_PAGE`, `PICKER_LIMIT`, `toBE`, `canAccess`, `*ActionState`

---

## 9. Checklist

- **Context**
  - [x] I understand what the system does and why
- **Correctness**
  - [ ] Matches requirements (C1, R5–R11)
  - [ ] Edge cases handled (R9, dates/ids)
  - [ ] Error paths handled (R3, R10)
  - [ ] Tests cover the change: no test framework exists
- **Readability**
  - [x] Names clear and consistent
  - [x] Logic mostly straightforward; comments are unusually good
  - [ ] No unnecessary complexity: upload logic triplicated, and several comments are stale
- **Architecture**
  - [x] Follows its own patterns (two-gate auth, one place for the contract)
  - [ ] Appropriate abstraction: missing a shared upload hook; the dialog state-reset pattern is repeated and broken 3×
  - [ ] Files within healthy size: several are 400–500 lines (acceptable, but decompose while fixing R6)
- **Security**
  - [x] No secrets in code (apart from the dev-only seed password, R4)
  - [x] Input validated at most boundaries
  - [ ] No injection: `ILIKE` wildcard (R2)
  - [ ] Auth checks: rate-limit bypass (R1)
  - [x] External data treated as untrusted (feed, API)
- **Performance**
  - [x] No N+1 in hot paths
  - [ ] No unbounded operations: activity-log full scans, rate-limiter prune
  - [x] Pagination on list endpoints
- **Verification**
  - [ ] Tests pass: none exist
  - [ ] Build succeeds: not run; `tsc` blocked by the ungenerated client
  - [ ] `api:verify`: blocked by a foreign process on :3000

**Verdict: Request changes.**
Suggested fix order:
1. C1
2. R2, R1, R4 (auth)
3. R5–R8 (files/editor)
4. R9–R11 (public)
5. R12
6. R13–R14 (ops)

Keep each group as its own small change.
