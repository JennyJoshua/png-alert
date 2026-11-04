# PNG Alert

Know what's happening before you get there. PNG Alert is a mobile-first web app where community members report local disruptions (roads, utilities, public services, notices), moderators review them, and the public reads a clearly labelled, sourced feed. It is **not** an emergency authority.

## Status

First implementation (MVP), submitted as a pull request for review. Nothing here has been run against a live Supabase project or deployed. See "What is verified" below.

## What works

- Account-based reporting (email + password via Supabase Auth). Anonymous reporting is switchable with `ALLOW_ANONYMOUS_REPORTS=true`.
- Moderation queue: approve, reject (reason required), edit public wording (original kept), merge duplicates, resolve, expire, corroborate, link an official source, record official confirmation. Every action is written to an append-only audit log.
- Public feed with search, province / locality / category filters, current vs past, pagination, detail pages, WhatsApp share, reader flags.
- Trust labels: Community report, Corroborated, Official source, Officially confirmed, Resolved, Stale, plus External source for linked items. Reported-at and last-confirmed-at are always separate; confirmations never change reported-at.
- Freshness windows per category (roads and utilities 12 h, public services 24 h). Notices and news are archive items unless they carry a validity period.
- Manual link submission (Facebook, news, official notices) with moderator-written short summaries. PNG Alert never fetches or copies third-party pages.
- Admin source registry. Automatic importing is **not** built (see `docs/SOURCE_AUDIT.md`).

## Not included yet

Photo upload (table exists, no UI or storage bucket), automatic RSS/feed import, push notifications, SMS, maps, multilingual UI, PWA icons, a moderator-management UI (promote moderators with SQL, below), formal accessibility and legal review.

## Run locally

```bash
npm install
cp .env.example .env.local      # fill in values for a Supabase project dedicated to PNG Alert
npm run dev
```

Without the environment variables the site renders in a safe "not connected" mode.

### Database

Apply `supabase/migrations/0001_init.sql` to a **new Supabase project dedicated to PNG Alert** (SQL editor or Supabase CLI). This repository does not create or modify any Supabase project, and must never share one with the PNG Materials Marketplace.

Promote the first administrator after they sign up (run in the SQL editor):

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

Moderators are `role = 'moderator'`.

## Checks

```bash
npm run check      # lint, typecheck, tests, build, secret scan
```

Tests include database tests that apply the real migration to an in-process Postgres (PGlite) with a small shim for the Supabase `auth` schema and roles. They exercise the workflow and RLS/permission rules. They do not exercise Supabase Auth, PostgREST or the Next.js routes against a live project.

## Approval gates

Needs the owner's approval before: creating the Supabase project, adding real environment values, deploying anywhere, enabling anonymous reporting, enabling any automatic importer, public launch (legal wording, contact details, moderator rota).

See `docs/ARCHITECTURE.md`, `docs/SOURCE_AUDIT.md`, `docs/CHANGELOG.md`.
