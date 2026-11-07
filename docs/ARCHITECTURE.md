# Architecture and security model

## Stack
Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth), plain CSS, system fonts, no client-side JavaScript on the core flows (forms post to route handlers and redirect), for low-bandwidth phones.

## Data flow
```
Browser form -> Next route handler (origin check, rate limit, zod validation, risk triage)
             -> Supabase RPC as service_role -> SECURITY DEFINER function (rules + audit) -> tables
Public pages -> anon client -> public_* views only (published rows, no reporter identity)
```

## Why the rules live in SQL
All state changes go through functions in `supabase/migrations/0001_init.sql`: `submit_incident`, `submit_source_item`, `cast_confirmation`, `submit_flag`, `moderate_incident`, `moderate_source_item`, `resolve_flag`, `admin_save_source`. Each re-checks the actor's role in the database, writes the audit row in the same transaction, and enforces state rules (reason required, official evidence required, one vote per account, no self-confirmation, hourly caps). This makes the rules testable against real Postgres and keeps a bug in a route handler from bypassing them.

## Access control
- RLS is enabled on every table. `anon` has no table access; it can only read `public_incidents`, `public_source_items`, `public_incident_sources`, `public_incident_history` (and `locations`).
- `authenticated` can read only its own rows (profiles, incidents, source items, confirmations). No client role can insert, update or delete. Roles cannot be self-escalated.
- Function execute rights are revoked from public/anon/authenticated and granted to `service_role` only.
- `moderation_actions` is append-only (trigger), even for privileged roles.
- The service-role key is read only in `lib/env.ts` (`server-only`). `npm run check:secrets` fails if it, or `serviceClient`, appears in the browser bundle, or if keys/.env files are committed.
- Route handlers require same-origin POSTs (CSRF), validate all input with zod, sanitise search terms, and map database errors to fixed user messages. The trust anchor is the configured `PNG_ALERT_PUBLIC_ORIGIN`; forwarded host/protocol headers are not trusted. In production, mutating routes return 503 until the owner supplies a valid HTTPS origin. Local development may use the request origin as a convenience.
- Production responses carry CSP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy headers.

## Trust model
`reported_at` is set at insert and never updated. `last_confirmed_at` moves only on a confirmation by a different account. Corroboration, official-source and official-confirmation are moderator decisions with required evidence; confirmation clicks never change a label. Stale and current are computed in the `public_incidents` view from category freshness windows, so they cannot drift.

## Safety triage
`lib/safety.ts` flags violence, conflict, accusation and political wording. Flags never auto-publish or auto-reject; a moderator must write a reason to approve a flagged item. Phone numbers and emails are rejected at validation. Crime, tribal conflict and political violence are outside published scope (community rules).

## Known limitations and decisions
- Reader flag abuse is capped in Postgres: 10 flags per authenticated account per hour and 60 anonymous flags globally per hour. Anonymous flagging stays available without storing IP addresses. The anonymous cap is one deployment-wide shared bucket, not a per-user or per-IP limit. An attacker can consume all 60 anonymous slots and prevent legitimate anonymous readers from flagging until the one-hour window resets. This is an intentional pilot-stage privacy/abuse trade-off; monitor for exhaustion and revisit the model if abuse or traffic warrants it. No paid or external rate-limit service is used.
- **Pilot limitation: the IP rate limiter is per instance.** `lib/rate-limit.ts` keeps counters in process memory, so each server instance counts separately and counters reset on restart. It slows casual abuse only. Per-account hourly caps are enforced in the database and apply across all instances (`submit_incident` 10/hour, `submit_source_item` 10/hour, `cast_confirmation` 30/hour). No paid or shared rate-limit service is used; adding one is a later decision for the owner.
- Moderator-authored public titles and summaries are checked for contact details both in Zod validation and by database constraints added in `0002_security_hardening.sql`. The new migration is not applied automatically.
- Form bodies are capped at 64 KB and must be form-encoded; anything else gets a 400 before parsing.
- Duplicate detection is exact (category + province + locality + normalised title, 24 h). It surfaces candidates to moderators; it does not auto-merge. Coordinated confirmation rings are not detected.
- Form dates are interpreted as PNG time (UTC+10).
- Locations are free text with a fixed province list; the `locations` table is for later admin-managed districts and localities.
- Reporting model: account-based by default (decision made so one-vote-per-account is meaningful); anonymous mode is a flag.
