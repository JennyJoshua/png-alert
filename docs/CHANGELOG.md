# Changelog

## 0.1.1 (remediation, issue #2)
- Added `package-lock.json`; CI now uses `npm ci`.
- CI runs the secret scan after the production build and fails if the built output is missing.
- All mutating routes read bodies through `readForm` (64 KB cap, form content types only; 400 otherwise).
- Added route-level, static-audit and environment tests; secret scan also checks client components and key naming.
- Documented the per-instance IP limiter as a pilot limitation. See `docs/SECURITY_AUDIT.md`.

## 0.1.0 (first implementation, pending review)
- Scaffold: Next.js 15 + TypeScript, Supabase migration `0001_init.sql`.
- Reporting, moderation, public feed, linked sources, source registry, flags, audit log.
- Trust labels, freshness windows, duplicate triage, risk triage, rate limits, CSRF guard, security headers.
- Tests: database workflow and RLS (PGlite), library unit tests, secret scan.
- Not included: photos, auto-import, notifications, moderator-management UI, legal review.
