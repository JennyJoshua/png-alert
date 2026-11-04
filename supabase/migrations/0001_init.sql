-- PNG Alert: initial schema.
-- Design: all tables are closed to anon/authenticated clients. Public pages read only the
-- public_* views (published rows, no reporter identity). Every write goes through
-- SECURITY DEFINER functions that are executable by service_role only (called from server routes).
-- Requires the Supabase `auth` schema (auth.users, auth.uid()) and roles anon/authenticated/service_role.

create type user_role as enum ('reporter', 'moderator', 'admin');
create type incident_category as enum ('roads_transport', 'utilities', 'public_services', 'official_notices', 'news_information');
create type review_status as enum ('pending', 'published', 'rejected', 'merged');
create type lifecycle_status as enum ('active', 'resolved', 'expired');
create type authority_status as enum ('none', 'official_source', 'officially_confirmed');
create type source_platform as enum ('facebook', 'other_social', 'news', 'official_notice');
create type confirmation_kind as enum ('confirm', 'dispute');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  role user_role not null default 'reporter',
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Freshness windows (configurable). NULL = archive item, never a "current" disruption by itself.
create table category_settings (
  category incident_category primary key,
  freshness_hours integer check (freshness_hours is null or freshness_hours > 0)
);
insert into category_settings (category, freshness_hours) values
  ('roads_transport', 12), ('utilities', 12), ('public_services', 24),
  ('official_notices', null), ('news_information', null);

create table locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references locations (id) on delete cascade,
  level text not null check (level in ('province', 'district', 'locality')),
  name text not null check (char_length(name) between 2 and 120),
  unique nulls not distinct (parent_id, name)
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  category incident_category not null,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  province text not null check (char_length(province) between 2 and 60),
  district text check (district is null or char_length(district) between 2 and 80),
  locality text not null check (char_length(locality) between 2 and 120),
  occurred_at timestamptz,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  reported_at timestamptz not null default now(),          -- never changed after insert
  submitted_by uuid references profiles (id) on delete set null,
  review_status review_status not null default 'pending',
  published_at timestamptz,
  public_title text check (public_title is null or char_length(public_title) between 5 and 120),
  public_summary text check (public_summary is null or char_length(public_summary) between 10 and 2000),
  corroborated boolean not null default false,             -- moderator decision, never automatic
  corroboration_note text,
  authority authority_status not null default 'none',
  authority_name text,
  authority_source_url text check (authority_source_url is null or authority_source_url ~* '^https?://'),
  authority_confirmed_at timestamptz,
  lifecycle lifecycle_status not null default 'active',
  resolved_at timestamptz,
  last_confirmed_at timestamptz,
  valid_until timestamptz,
  risk_flags text[] not null default '{}',
  dedupe_key text not null,
  possible_duplicate_of uuid references incidents (id),
  merged_into_id uuid references incidents (id),
  constraint officially_confirmed_needs_authority check (
    authority <> 'officially_confirmed' or (authority_name is not null and authority_confirmed_at is not null)),
  constraint official_source_needs_url check (authority = 'none' or authority_source_url is not null)
);
create index incidents_feed_idx on incidents (review_status, reported_at desc);
create index incidents_dedupe_idx on incidents (dedupe_key, reported_at desc);
create index incidents_place_idx on incidents (province, category);

create table source_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  domain text not null unique check (domain = lower(domain) and domain !~ '[/ ]'),
  source_type source_platform not null,
  is_official boolean not null default false,
  feed_url text check (feed_url is null or feed_url ~* '^https?://'),
  ingestion_method text not null default 'manual' check (ingestion_method in ('manual', 'rss')),
  terms_note text,
  last_checked_at timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rss_needs_feed check (ingestion_method = 'manual' or feed_url is not null)
);

create table source_items (
  id uuid primary key default gen_random_uuid(),
  platform source_platform not null,
  url text not null check (url ~* '^https?://'),
  canonical_url text not null,
  registry_id uuid references source_registry (id),
  source_name text check (source_name is null or char_length(source_name) <= 120),
  title text check (title is null or char_length(title) between 5 and 200),
  summary text check (summary is null or char_length(summary) between 10 and 500), -- moderator-written, short
  submitter_context text not null check (char_length(submitter_context) between 5 and 500),
  province text not null check (char_length(province) between 2 and 60),
  district text check (district is null or char_length(district) between 2 and 80),
  locality text not null check (char_length(locality) between 2 and 120),
  source_published_at timestamptz,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references profiles (id) on delete set null,
  review_status review_status not null default 'pending',
  published_at timestamptz,
  is_official boolean not null default false,
  risk_flags text[] not null default '{}',
  constraint published_needs_text check (review_status <> 'published' or (title is not null and summary is not null))
);
create unique index source_items_live_url_idx on source_items (canonical_url) where review_status in ('pending', 'published');

create table incident_sources (
  incident_id uuid not null references incidents (id) on delete cascade,
  source_item_id uuid not null references source_items (id) on delete cascade,
  linked_by uuid references profiles (id),
  linked_at timestamptz not null default now(),
  primary key (incident_id, source_item_id)
);

create table confirmations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  kind confirmation_kind not null,
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (incident_id, user_id)
);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles (id),
  target_type text not null check (target_type in ('incident', 'source_item', 'source_registry')),
  target_id uuid not null,
  action text not null,
  reason text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create function moderation_actions_append_only() returns trigger language plpgsql as $$
begin raise exception 'moderation_actions is append-only'; end $$;
create trigger moderation_actions_no_change before update or delete on moderation_actions
  for each row execute function moderation_actions_append_only();

create table content_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('incident', 'source_item')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 500),
  flagged_by uuid references profiles (id) on delete set null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Optional photo metadata. Upload UI and storage bucket are intentionally not part of this migration.
create table media (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents (id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create function normalize_text(t text) returns text language sql immutable as
$$ select trim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g')) $$;

create function assert_moderator(p_actor uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_actor is null or not exists (select 1 from profiles where id = p_actor and role in ('moderator', 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function assert_admin(p_actor uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_actor is null or not exists (select 1 from profiles where id = p_actor and role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- submissions
create function submit_incident(
  p_user uuid, p_category incident_category, p_title text, p_description text, p_province text,
  p_district text, p_locality text, p_occurred_at timestamptz, p_source_url text, p_risk_flags text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare k text; dup uuid; new_id uuid;
begin
  if p_user is not null and (select count(*) from incidents where submitted_by = p_user and reported_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;
  k := md5(p_category::text || '|' || normalize_text(p_province) || '|' || normalize_text(p_locality) || '|' || normalize_text(p_title));
  if p_user is not null and exists (select 1 from incidents where submitted_by = p_user and dedupe_key = k and reported_at > now() - interval '24 hours') then
    raise exception 'duplicate_submission';
  end if;
  select id into dup from incidents
    where dedupe_key = k and review_status in ('pending', 'published') and reported_at > now() - interval '24 hours'
    order by reported_at limit 1;
  insert into incidents (category, title, description, province, district, locality, occurred_at, source_url,
                         submitted_by, risk_flags, dedupe_key, possible_duplicate_of)
  values (p_category, p_title, p_description, p_province, p_district, p_locality, p_occurred_at, p_source_url,
          p_user, coalesce(p_risk_flags, '{}'), k, dup)
  returning id into new_id;
  return new_id;
end $$;

create function submit_source_item(
  p_user uuid, p_platform source_platform, p_url text, p_canonical text, p_context text, p_province text,
  p_district text, p_locality text, p_published_at timestamptz, p_risk_flags text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if p_user is not null and (select count(*) from source_items where submitted_by = p_user and submitted_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;
  begin
    insert into source_items (platform, url, canonical_url, submitter_context, province, district, locality,
                              source_published_at, submitted_by, risk_flags)
    values (p_platform, p_url, p_canonical, p_context, p_province, p_district, p_locality, p_published_at,
            p_user, coalesce(p_risk_flags, '{}'))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'duplicate_source';
  end;
  return new_id;
end $$;

create function cast_confirmation(p_user uuid, p_incident uuid, p_kind confirmation_kind, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare inc incidents;
begin
  if p_user is null then raise exception 'login_required'; end if;
  if (select count(*) from confirmations where user_id = p_user and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  select * into inc from incidents where id = p_incident for update;
  if not found or inc.review_status <> 'published' then raise exception 'not_found'; end if;
  if inc.lifecycle <> 'active' then raise exception 'not_active'; end if;
  if inc.submitted_by = p_user then raise exception 'own_report'; end if;
  begin
    insert into confirmations (incident_id, user_id, kind, reason) values (p_incident, p_user, p_kind, p_reason);
  exception when unique_violation then
    raise exception 'already_voted';
  end;
  -- Only last_confirmed_at moves. reported_at is never touched.
  if p_kind = 'confirm' then update incidents set last_confirmed_at = now() where id = p_incident; end if;
end $$;

create function submit_flag(p_user uuid, p_type text, p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'incident' and not exists (select 1 from incidents where id = p_target and review_status = 'published') then raise exception 'not_found'; end if;
  if p_type = 'source_item' and not exists (select 1 from source_items where id = p_target and review_status = 'published') then raise exception 'not_found'; end if;
  insert into content_flags (target_type, target_id, reason, flagged_by) values (p_type, p_target, p_reason, p_user);
end $$;

-- ---------------------------------------------------------------- moderation
create function moderate_incident(
  p_actor uuid, p_id uuid, p_action text, p_reason text, p_title text, p_summary text, p_extra jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare inc incidents; has_reason boolean := coalesce(char_length(trim(p_reason)), 0) >= 5; target uuid;
begin
  perform assert_moderator(p_actor);
  select * into inc from incidents where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_action = 'approve' then
    if inc.review_status <> 'pending' then raise exception 'invalid_state'; end if;
    if cardinality(inc.risk_flags) > 0 and not has_reason then raise exception 'reason_required'; end if;
    update incidents set review_status = 'published', published_at = now(),
      public_title = nullif(trim(p_title), ''), public_summary = nullif(trim(p_summary), ''),
      valid_until = nullif(p_extra ->> 'valid_until', '')::timestamptz
      where id = p_id;
  elsif p_action = 'reject' then
    if inc.review_status <> 'pending' then raise exception 'invalid_state'; end if;
    if not has_reason then raise exception 'reason_required'; end if;
    update incidents set review_status = 'rejected' where id = p_id;
  elsif p_action = 'edit' then
    if inc.review_status not in ('pending', 'published') then raise exception 'invalid_state'; end if;
    if nullif(trim(p_title), '') is null and nullif(trim(p_summary), '') is null then raise exception 'nothing_to_edit'; end if;
    update incidents set public_title = coalesce(nullif(trim(p_title), ''), public_title),
      public_summary = coalesce(nullif(trim(p_summary), ''), public_summary) where id = p_id;
  elsif p_action in ('resolve', 'expire') then
    if inc.review_status <> 'published' or inc.lifecycle <> 'active' then raise exception 'invalid_state'; end if;
    if not has_reason then raise exception 'reason_required'; end if;
    if p_action = 'resolve' then
      update incidents set lifecycle = 'resolved', resolved_at = now() where id = p_id;
    else
      update incidents set lifecycle = 'expired' where id = p_id;
    end if;
  elsif p_action = 'corroborate' then
    if inc.review_status <> 'published' then raise exception 'invalid_state'; end if;
    if not has_reason then raise exception 'reason_required'; end if;
    update incidents set corroborated = true, corroboration_note = p_reason where id = p_id;
  elsif p_action = 'mark_official_source' then
    if inc.review_status <> 'published' or inc.authority <> 'none' then raise exception 'invalid_state'; end if;
    if nullif(p_extra ->> 'authority_name', '') is null or nullif(p_extra ->> 'authority_source_url', '') is null then raise exception 'authority_required'; end if;
    update incidents set authority = 'official_source', authority_name = p_extra ->> 'authority_name',
      authority_source_url = p_extra ->> 'authority_source_url' where id = p_id;
  elsif p_action = 'confirm_official' then
    if inc.review_status <> 'published' then raise exception 'invalid_state'; end if;
    if not has_reason or nullif(p_extra ->> 'authority_name', '') is null or nullif(p_extra ->> 'authority_source_url', '') is null
       or nullif(p_extra ->> 'confirmed_at', '') is null then raise exception 'authority_required'; end if;
    update incidents set authority = 'officially_confirmed', authority_name = p_extra ->> 'authority_name',
      authority_source_url = p_extra ->> 'authority_source_url',
      authority_confirmed_at = (p_extra ->> 'confirmed_at')::timestamptz where id = p_id;
  elsif p_action = 'merge' then
    if inc.review_status not in ('pending', 'published') then raise exception 'invalid_state'; end if;
    target := nullif(p_extra ->> 'merge_into', '')::uuid;
    if target is null or target = p_id or not has_reason
       or not exists (select 1 from incidents where id = target and review_status = 'published') then raise exception 'invalid_merge'; end if;
    update incidents set review_status = 'merged', merged_into_id = target where id = p_id;
  else
    raise exception 'unknown_action';
  end if;

  insert into moderation_actions (actor_id, target_type, target_id, action, reason, details)
  values (p_actor, 'incident', p_id, p_action, p_reason,
          jsonb_build_object('from_status', inc.review_status, 'title', p_title, 'summary', p_summary) || coalesce(p_extra, '{}'));
end $$;

create function moderate_source_item(
  p_actor uuid, p_id uuid, p_action text, p_reason text, p_title text, p_summary text, p_extra jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare s source_items; reg source_registry; link uuid := nullif(p_extra ->> 'link_incident', '')::uuid;
begin
  perform assert_moderator(p_actor);
  select * into s from source_items where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_action = 'approve' then
    if s.review_status <> 'pending' then raise exception 'invalid_state'; end if;
    if nullif(trim(p_title), '') is null or nullif(trim(p_summary), '') is null then raise exception 'summary_required'; end if;
    if coalesce(p_extra ->> 'registry_id', '') <> '' then
      select * into reg from source_registry where id = (p_extra ->> 'registry_id')::uuid;
      if not found then raise exception 'unknown_registry'; end if;
    end if;
    if coalesce((p_extra ->> 'is_official')::boolean, false) and (reg.id is null or not reg.is_official) then
      raise exception 'official_requires_registry';
    end if;
    update source_items set review_status = 'published', published_at = now(), title = trim(p_title), summary = trim(p_summary),
      registry_id = reg.id, source_name = coalesce(reg.name, nullif(p_extra ->> 'source_name', '')),
      is_official = coalesce((p_extra ->> 'is_official')::boolean, false)
      where id = p_id;
  elsif p_action = 'reject' then
    if s.review_status <> 'pending' then raise exception 'invalid_state'; end if;
    if coalesce(char_length(trim(p_reason)), 0) < 5 then raise exception 'reason_required'; end if;
    update source_items set review_status = 'rejected' where id = p_id;
  elsif p_action = 'edit' then
    if s.review_status <> 'published' then raise exception 'invalid_state'; end if;
    update source_items set title = coalesce(nullif(trim(p_title), ''), title), summary = coalesce(nullif(trim(p_summary), ''), summary) where id = p_id;
  elsif p_action = 'link' then
    if s.review_status <> 'published' then raise exception 'invalid_state'; end if;
  else
    raise exception 'unknown_action';
  end if;

  if link is not null then
    if not exists (select 1 from incidents where id = link and review_status = 'published') then raise exception 'invalid_link'; end if;
    insert into incident_sources (incident_id, source_item_id, linked_by) values (link, p_id, p_actor) on conflict do nothing;
  end if;

  insert into moderation_actions (actor_id, target_type, target_id, action, reason, details)
  values (p_actor, 'source_item', p_id, p_action, p_reason, jsonb_build_object('from_status', s.review_status) || coalesce(p_extra, '{}'));
end $$;

create function admin_save_source(
  p_actor uuid, p_name text, p_domain text, p_type source_platform, p_is_official boolean,
  p_feed_url text, p_method text, p_terms_note text, p_enabled boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  perform assert_admin(p_actor);
  insert into source_registry (name, domain, source_type, is_official, feed_url, ingestion_method, terms_note, enabled)
  values (p_name, lower(p_domain), p_type, p_is_official, p_feed_url, p_method, p_terms_note, p_enabled)
  on conflict (domain) do update set name = excluded.name, source_type = excluded.source_type, is_official = excluded.is_official,
    feed_url = excluded.feed_url, ingestion_method = excluded.ingestion_method, terms_note = excluded.terms_note, enabled = excluded.enabled
  returning id into rid;
  insert into moderation_actions (actor_id, target_type, target_id, action, reason, details)
  values (p_actor, 'source_registry', rid, 'save_source', null, jsonb_build_object('domain', lower(p_domain), 'enabled', p_enabled));
  return rid;
end $$;

create function resolve_flag(p_actor uuid, p_flag uuid) returns void language plpgsql security definer set search_path = public as $$
declare f content_flags;
begin
  perform assert_moderator(p_actor);
  update content_flags set resolved = true where id = p_flag and not resolved returning * into f;
  if not found then raise exception 'not_found'; end if;
  insert into moderation_actions (actor_id, target_type, target_id, action, reason, details)
  values (p_actor, f.target_type, f.target_id, 'resolve_flag', null, jsonb_build_object('flag_id', p_flag));
end $$;

-- ---------------------------------------------------------------- public read views (published only, no reporter identity)
create view public_incidents as
select *, (not is_stale and lifecycle = 'active' and (freshness_hours is not null or (valid_until is not null and valid_until > now()))) as is_current,
  case
    when lifecycle = 'resolved' then 'resolved'
    when lifecycle = 'expired' or is_stale then 'stale'
    when authority = 'officially_confirmed' then 'officially_confirmed'
    when authority = 'official_source' then 'official_source'
    when corroborated then 'corroborated'
    else 'community_report'
  end as trust_label
from (
  select i.id, i.category, coalesce(i.public_title, i.title) as title, coalesce(i.public_summary, i.description) as summary,
    i.province, i.district, i.locality, i.occurred_at, i.source_url, i.reported_at, i.published_at, i.last_confirmed_at,
    i.corroborated, i.authority, i.authority_name, i.authority_source_url, i.authority_confirmed_at,
    i.lifecycle, i.resolved_at, i.valid_until, cs.freshness_hours,
    (select count(*) from confirmations c where c.incident_id = i.id and c.kind = 'confirm')::int as confirm_count,
    (select count(*) from confirmations c where c.incident_id = i.id and c.kind = 'dispute')::int as dispute_count,
    (i.lifecycle = 'active' and (
       (i.valid_until is not null and i.valid_until < now())
       or (i.valid_until is null and cs.freshness_hours is not null
           and now() > greatest(i.reported_at, coalesce(i.last_confirmed_at, i.reported_at)) + make_interval(hours => cs.freshness_hours))
    )) as is_stale
  from incidents i join category_settings cs on cs.category = i.category
  where i.review_status = 'published'
) t;

create view public_source_items as
select s.id, s.platform, s.url, s.canonical_url, coalesce(r.name, s.source_name) as source_name, s.title, s.summary,
  s.province, s.district, s.locality, s.source_published_at, s.published_at, s.is_official
from source_items s left join source_registry r on r.id = s.registry_id
where s.review_status = 'published';

create view public_incident_sources as
select l.incident_id, p.*
from incident_sources l
join public_source_items p on p.id = l.source_item_id
join incidents i on i.id = l.incident_id and i.review_status = 'published';

create view public_incident_history as
select target_id as incident_id, action, created_at
from moderation_actions
where target_type = 'incident'
  and action in ('approve', 'edit', 'resolve', 'expire', 'corroborate', 'mark_official_source', 'confirm_official')
  and exists (select 1 from incidents i where i.id = target_id and i.review_status = 'published');

-- ---------------------------------------------------------------- row level security and grants
alter table profiles enable row level security;
alter table category_settings enable row level security;
alter table locations enable row level security;
alter table incidents enable row level security;
alter table source_registry enable row level security;
alter table source_items enable row level security;
alter table incident_sources enable row level security;
alter table confirmations enable row level security;
alter table moderation_actions enable row level security;
alter table content_flags enable row level security;
alter table media enable row level security;

create policy profiles_read_own on profiles for select to authenticated using (id = auth.uid());
create policy incidents_read_own on incidents for select to authenticated using (submitted_by = auth.uid());
create policy source_items_read_own on source_items for select to authenticated using (submitted_by = auth.uid());
create policy confirmations_read_own on confirmations for select to authenticated using (user_id = auth.uid());
create policy locations_read on locations for select to anon, authenticated using (true);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on profiles, incidents, source_items, confirmations to authenticated;
grant select on locations to anon, authenticated;
grant select on public_incidents, public_source_items, public_incident_sources, public_incident_history to anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
