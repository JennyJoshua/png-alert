# Security audit of mutating routes (issue #2)

Scope: every `app/api/**/route.ts`. Method: code review plus tests that call each route handler directly (`tests/api.routes.test.ts`) and a static test that fails if a future route skips a control (`tests/api.audit.test.ts`).

| Route | Same-origin guard | IP limiter (per instance) | Authentication | Authorisation | Input validation |
|---|---|---|---|---|---|
| `POST /api/reports` | yes | 8 / 10 min | account required unless `ALLOW_ANONYMOUS_REPORTS=true` (default false) | none needed | zod `reportSchema`; contact details rejected |
| `POST /api/sources` | yes | 8 / 10 min | same as above | none needed | zod `sourceSchema`; URL canonicalised |
| `POST /api/incidents/:id/vote` | yes | 30 / 10 min | account required, always | one response per account, not own report (database) | uuid + zod `voteSchema` |
| `POST /api/incidents/:id/flag` | yes | 30 / 10 min | **anonymous allowed on purpose** | target must be published (database) | uuid + zod `flagSchema` |
| `POST /api/auth/login`, `signup`, `logout` | yes | 10 / 10 min | n/a | n/a | zod credentials; `safeNext` blocks open redirects |
| `POST /api/moderation` | yes | none (privileged) | login required | moderator or admin; database re-checks the actor's role | zod `moderationSchema` with per-target action allow-list |
| `POST /api/admin/sources` | yes | none (privileged) | login required | admin only; database `assert_admin`; saved as manual and disabled | zod `registrySchema` |

All routes export POST only (other methods return 405). Database per-account limits apply in addition (reports 10/h, links 10/h, votes 30/h).

## Omission found and fixed
Every route called `req.formData()` directly, so a malformed, wrongly typed or very large body caused an unhandled error or an unbounded read. All routes now use `readForm` (`lib/http.ts`): form content types only, 64 KB cap enforced while streaming, `400` otherwise. Two mutation checks confirmed the tests fail if a route goes back to a bare `formData()` or loses its guard.

## Reviewed and deliberately unchanged
- Anonymous flagging stays open so readers can report harmful content without an account. It is rate limited and only stores a text reason against a published item. Owner may choose to require login instead.
- Moderation and admin routes have no IP limiter. They are role-gated, and every action is audit-logged in the database.
- Unauthenticated callers get a login redirect from `/api/moderation` but a 403 from `/api/admin/sources` (cosmetic).
- The origin check compares `Origin` with `X-Forwarded-Host` or `Host`. Deploy behind a platform that sets or overwrites `X-Forwarded-Host`. A browser cannot set that header cross-site, so this does not enable CSRF.
- The IP limiter is per instance and in memory (pilot limitation, see `ARCHITECTURE.md`).

## Service-role key
- `SUPABASE_SERVICE_ROLE_KEY` is read only in `lib/env.ts`, which imports `server-only` (a client import fails the build). `serviceClient` is used only by `lib/auth.ts`, `lib/repo.ts` and `app/api/**`.
- There are no client components. A test fails if a client component ever imports a server module, or if the key gets a `NEXT_PUBLIC_` name.
- Build check: built with a fake sentinel value as the key. It was absent from `.next/static` and `.next/server`; the key name and `serviceClient` were absent from client files; `npm run check:secrets:built` passed. A negative control (sentinel planted in a built client file) made the scan fail.
