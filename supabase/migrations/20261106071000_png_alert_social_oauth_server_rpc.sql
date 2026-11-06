-- Server-only RPC boundary for Phase 2 social account linking.
-- These functions are callable only by service_role from trusted Edge Functions.
-- They do not persist provider access tokens, refresh tokens, authorization codes or secrets.

create or replace function public.social_oauth_attempt_create(
  p_user_id uuid,
  p_provider_code text,
  p_state_hash text,
  p_nonce_hash text,
  p_pkce_verifier_ciphertext text,
  p_requested_scopes text[],
  p_callback_uri text,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_attempt_id uuid;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '10 minutes' then
    raise exception 'Invalid OAuth attempt expiry' using errcode = '22023';
  end if;

  select id into v_provider_id
  from public.social_providers
  where code = p_provider_code
    and enabled = true
    and identity_supported = true;

  if v_provider_id is null then
    raise exception 'Provider is not enabled for identity linking' using errcode = '22023';
  end if;

  if exists (
    select 1 from private.social_account_connections
    where user_id = p_user_id
      and provider_id = v_provider_id
      and connection_status in ('connected', 'reauthorization_required')
  ) then
    raise exception 'An active account is already linked for this provider' using errcode = '23505';
  end if;

  insert into private.social_oauth_attempts (
    user_id, provider_id, state_hash, nonce_hash, pkce_verifier_ciphertext,
    requested_scopes, callback_uri, expires_at
  ) values (
    p_user_id, v_provider_id, p_state_hash, p_nonce_hash, p_pkce_verifier_ciphertext,
    coalesce(p_requested_scopes, '{}'::text[]), p_callback_uri, p_expires_at
  ) returning id into v_attempt_id;

  insert into private.social_connection_events (user_id, provider_id, event_type, actor_type, details)
  values (p_user_id, v_provider_id, 'connection_initiated', 'user',
    jsonb_build_object('attempt_id', v_attempt_id));

  return v_attempt_id;
end;
$$;

create or replace function public.social_oauth_attempt_consume(
  p_state_hash text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt record;
begin
  update private.social_oauth_attempts a
  set attempt_status = 'completed',
      consumed_at = now()
  where a.state_hash = p_state_hash
    and a.attempt_status = 'pending'
    and a.expires_at > now()
  returning a.id, a.user_id, a.provider_id, a.pkce_verifier_ciphertext,
            a.nonce_hash, a.requested_scopes, a.callback_uri
  into v_attempt;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'provider_code', (select p.code from public.social_providers p where p.id = v_attempt.provider_id),
    'pkce_verifier_ciphertext', v_attempt.pkce_verifier_ciphertext,
    'nonce_hash', v_attempt.nonce_hash,
    'requested_scopes', v_attempt.requested_scopes,
    'callback_uri', v_attempt.callback_uri
  );
end;
$$;

create or replace function public.social_connection_create(
  p_user_id uuid,
  p_provider_code text,
  p_external_account_id text,
  p_external_username text,
  p_display_name text,
  p_profile_url text,
  p_avatar_url text,
  p_granted_scopes text[]
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_connection_id uuid;
begin
  select id into v_provider_id
  from public.social_providers
  where code = p_provider_code
    and enabled = true
    and identity_supported = true;

  if v_provider_id is null then
    raise exception 'Provider is not enabled for identity linking' using errcode = '22023';
  end if;

  begin
    insert into private.social_account_connections (
      user_id, provider_id, external_account_id, external_username,
      display_name, profile_url, avatar_url, granted_scopes,
      connection_status, last_verified_at
    ) values (
      p_user_id, v_provider_id, p_external_account_id, p_external_username,
      p_display_name, p_profile_url, p_avatar_url,
      coalesce(p_granted_scopes, '{}'::text[]), 'connected', now()
    ) returning id into v_connection_id;
  exception when unique_violation then
    raise exception 'SOCIAL_IDENTITY_CONFLICT' using errcode = '23505';
  end;

  insert into private.social_connection_events (
    user_id, connection_id, provider_id, event_type, actor_type, details
  ) values (
    p_user_id, v_connection_id, v_provider_id, 'connection_created', 'system',
    jsonb_build_object('provider_code', p_provider_code)
  );

  return v_connection_id;
end;
$$;

create or replace function public.social_connection_disconnect(
  p_user_id uuid,
  p_provider_code text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection record;
begin
  update private.social_account_connections c
  set connection_status = 'disconnected',
      disconnected_at = now(),
      updated_at = now()
  where c.user_id = p_user_id
    and c.connection_status in ('connected', 'reauthorization_required')
    and c.provider_id = (select p.id from public.social_providers p where p.code = p_provider_code)
  returning c.id, c.provider_id into v_connection;

  if not found then
    return false;
  end if;

  insert into private.social_connection_events (
    user_id, connection_id, provider_id, event_type, actor_type, details
  ) values (
    p_user_id, v_connection.id, v_connection.provider_id,
    'connection_disconnected', 'user', '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.social_connection_list(
  p_user_id uuid
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider_code', p.code,
        'external_account_id', c.external_account_id,
        'external_username', c.external_username,
        'display_name', c.display_name,
        'profile_url', c.profile_url,
        'avatar_url', c.avatar_url,
        'granted_scopes', c.granted_scopes,
        'connection_status', c.connection_status,
        'linked_at', c.linked_at,
        'last_verified_at', c.last_verified_at,
        'disconnected_at', c.disconnected_at
      ) order by c.created_at desc
    ),
    '[]'::jsonb
  )
  from private.social_account_connections c
  join public.social_providers p on p.id = c.provider_id
  where c.user_id = p_user_id;
$$;

revoke all on function public.social_oauth_attempt_create(uuid,text,text,text,text,text[],text,timestamptz) from public, anon, authenticated;
revoke all on function public.social_oauth_attempt_consume(text) from public, anon, authenticated;
revoke all on function public.social_connection_create(uuid,text,text,text,text,text,text,text[]) from public, anon, authenticated;
revoke all on function public.social_connection_disconnect(uuid,text) from public, anon, authenticated;
revoke all on function public.social_connection_list(uuid) from public, anon, authenticated;

grant execute on function public.social_oauth_attempt_create(uuid,text,text,text,text,text[],text,timestamptz) to service_role;
grant execute on function public.social_oauth_attempt_consume(text) to service_role;
grant execute on function public.social_connection_create(uuid,text,text,text,text,text,text,text[]) to service_role;
grant execute on function public.social_connection_disconnect(uuid,text) to service_role;
grant execute on function public.social_connection_list(uuid) to service_role;

comment on function public.social_oauth_attempt_create(uuid,text,text,text,text,text[],text,timestamptz)
  is 'Server-only creation of a short-lived social OAuth attempt.';
comment on function public.social_oauth_attempt_consume(text)
  is 'Atomically consumes one unexpired social OAuth state exactly once; callable only by service_role.';
comment on function public.social_connection_create(uuid,text,text,text,text,text,text,text[])
  is 'Server-only persistence of verified provider identity metadata; provider tokens are never accepted.';
comment on function public.social_connection_disconnect(uuid,text)
  is 'Disconnects one provider account owned by the specified authenticated PNG Alert user.';
comment on function public.social_connection_list(uuid)
  is 'Returns social account metadata for a user; callable only by service_role.';
