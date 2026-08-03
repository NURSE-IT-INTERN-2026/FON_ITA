<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16 Agent Rules

This project uses **Next.js 16** with breaking changes from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

## Breaking Changes from Older Next.js

### Middleware → Proxy

Middleware is renamed to **Proxy** in Next.js 16.

| Version | File | Export |
|---|---|---|
| v14-15 | `middleware.ts` | `middleware()` |
| v16+ | `proxy.ts` | `proxy()` |

- File location: project root or `src/` (same level as `app/`)
- Uses `export function proxy(request: NextRequest)` or `export default function proxy(request: NextRequest)`
- `config.matcher` works the same way
- Runtime: defaults to **Node.js** (not Edge like v14-15)

### Async APIs (Next.js 15+)

These are now async — always `await` them:

```ts
const params = await props.params;           // route params
const searchParams = await props.searchParams; // page searchParams
const cookieStore = await cookies();          // cookies()
const headersList = await headers();          // headers()
```

### Auth Functions

- `unauthorized()` — throws 401, renders `unauthorized.tsx` (needs `experimental.authInterrupts` in next.config)
- `forbidden()` — throws 403, renders `forbidden.tsx` (needs `experimental.authInterrupts` in next.config)
- Both work like `notFound()` — call directly, don't wrap in try/catch

### Form Actions Reset the Form (React 19)

`<form action={fn}>` **resets every uncontrolled field as soon as `fn` returns** — React assumes
the submit succeeded. Every Server Action in this project returns `{ error }` instead of throwing
(so the message can be Thai), so a rejected save wiped the form. Fields using `defaultValue` are
worse than blank: they revert to the **last saved value**, so the person sees an error above
fields that look untouched while their edits are gone.

```tsx
// ✗ loses user input whenever the action returns an error
<form action={submit}>

// ✓
<form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
```

`useActionState` is affected too. Call `formAction(formData)` yourself inside `startTransition`,
and drop `useFormStatus` — it reads the `action` prop that no longer exists; use the third value
returned by `useActionState` for pending instead.

`action={fn}` is only safe when the action **always** redirects or throws. See `decisions.md` D24.

### RSC Headers Stripped in Proxy

Next.js 16 strips `RSC`, `next-router-state-tree`, `next-router-prefetch` headers from `request.headers` in proxy. Do NOT check these headers to detect RSC requests — they are always `null`.

---

## basePath Rules

This project uses `basePath: "/fonita"`. Different contexts handle basePath differently:

| Context | Path matching | Redirect URL |
|---|---|---|
| **proxy.ts** `pathname` | No basePath | — |
| **proxy.ts** `NextResponse.redirect()` | — | Must include `/fonita/...` |
| **Route Handlers** `NextResponse.redirect()` | — | Must include `/fonita/...` |
| **Server Actions** `redirect()` | — | No basePath (auto-added) |
| **Client** `<Link>`, `router.push()` | — | No basePath (auto-added) |
| **`fetch()` inside the app** | — | MUST include `/fonita` |
| **Session cookie `path`** | — | `/fonita` (NOT `/`) |

### Public API path

Consumers call the faculty website's Public API at:
- `https://service.nurse.cmu.ac.th/fonita/api/v1/ita/{year}`
- `https://service.nurse.cmu.ac.th/fonita/api/nurse/youtube-feed`

No `rewrites` needed — the system mounts under `/fonita` and consumers call with basePath.

Full details: `.agents/skills/basepath-handling/SKILL.md`

---

## Skills System

Read skills BEFORE writing code. Mandatory skills are listed in `CLAUDE.md`.

Available skills:
- `basepath-handling` — basePath rules per context
- `next-best-practices` — file conventions, RSC boundaries, async patterns
- `implement-feature` — step-by-step feature workflow
- `review-feature` — post-implementation review checklist
- `cmu-oauth-integration` — OAuth patterns reference
- `custom-auth` — opaque token session patterns (no library)
- `react-form-actions` — why `<form action={fn}>` discards input, and what to use instead
- `api-pagination` — page/cursor strategies, unique sort keys, capped-list disclosure

<!-- END:nextjs-agent-rules -->
