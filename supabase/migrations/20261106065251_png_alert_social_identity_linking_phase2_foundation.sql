-- PNG Alert Phase 2 foundation: private social identity connections and OAuth transactions.
-- Identity linking only. No provider access/refresh tokens are persisted.
-- Provider OAuth handlers and credentials are intentionally out of scope for this migration.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.social_account_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.social_providers(id) on delete restrict,
  external_account_id text not null check (length(external_account_id) between 1 and 512),
  external_username text check (external_username is null or length(external_username) <= 255),
  display_name text check (display_name is null or length(display_name) <= 255),
  profile_url text check (profile_url is null or length(profile_url) <= 2048),
  avatar_url text check (avatar_url is null or length(avatar_url) <= 2048),
  granted_scopes text[] not null default '{}',
  connection_status text not null default 'connected'
    check (connection_status in ('connected','reauthorization_required','disconnected','revoked','error')),
  linked_at timestamptz not null default now(),
  last_verified_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_account_connections_disconnected_at_check
    check (
      (connection_status in ('disconnected', 'revoked') and disconnected_at is not null)
      or (connection_status not in ('disconnected', 'revoked') and disconnected_at is null)
    )
);

create unique index social_account_connections_provider_identity_active_uidx
  on private.social_account_connections(provider_id, external_account_id)
  where connection_status in ('connected', 'reauthorization_required');

create unique index social_account_connections_user_provider_active_uidx
  on private.social_account_connections(user_id, provider_id)
  where connection_status in ('connected', 'reauthorization_required');

create index social_account_connections_user_created_idx
  on private.social_account_connections(user_id, created_at desc);

create table private.social_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.social_providers(id) on delete restrict,
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text check (nonce_hash is null or nonce_hash ~ '^[a-f0-9]{64}$'),
  -- PKCE verifier is encrypted by the trusted server before persistence.
  -- Encryption key belongs in server-side secrets, never in this database row or client.
  pkce_verifier_ciphertext text not null check (length(pkce_verifier_ciphertext) between 1 and 4096),
  requested_scopes text[] not null default '{}',
  callback_uri text not null check (length(callback_uri) between 1 and 2048),
  attempt_status text not null default 'pending'
    check (attempt_status in ('pending', 'completed', 'failed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint social_oauth_attempts_consumption_check
    check (
      (attempt_status = 'pending' and consumed_at is null)
      or (attempt_status <> 'pending' and consumed_at is not null)
    ),
  constraint social_oauth_attempts_expiry_check check (expires_at > created_at)
);

create index social_oauth_attempts_pending_expiry_idx
  on private.social_oauth_attempts(expires_at) where attempt_status = 'pending';
create index social_oauth_attempts_user_created_idx
  on private.social_oauth_attempts(user_id, created_at desc);

create table private.social_connection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references private.social_account_connections(id) on delete set null,
  provider_id uuid not null references public.social_providers(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'connection_initiated','connection_created','connection_refreshed',
      'reauthorization_required','connection_disconnected','connection_revoked',
      'connection_failed','identity_conflict'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('user', 'system', 'provider')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index social_connection_events_user_created_idx
  on private.social_connection_events(user_id, created_at desc);
create index social_connection_events_connection_created_idx
  on private.social_connection_events(connection_id, created_at desc);

alter table private.social_account_connections enable row level security;
alter table private.social_account_connections force row level security;
alter table private.social_oauth_attempts enable row level security;
alter table private.social_oauth_attempts force row level security;
alter table private.social_connection_events enable row level security;
alter table private.social_connection_events force row level security;

revoke all on all tables in schema private from public, anon, authenticated;
grant all privileges on all tables in schema private to service_role;

comment on schema private is 'Trusted server-side data only. Do not expose through the Supabase Data API.';
comment on table private.social_account_connections is 'Verified external social identities linked to PNG Alert users. Provider access and refresh tokens are not stored.';
comment on table private.social_oauth_attempts is 'Short-lived server-managed OAuth transactions. PKCE verifier ciphertext must be encrypted by the trusted backend.';
comment on table private.social_connection_events is 'Audit trail for social account connection lifecycle events. Never store access tokens, refresh tokens, client secrets or raw authorization codes.';
