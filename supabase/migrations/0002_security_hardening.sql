-- Issue #8: database-enforced abuse limits for anonymous and account-based flags,
-- plus defence-in-depth rejection of contact details in moderator-authored public text.
-- This migration is additive; it does not apply or modify any remote database by itself.

create or replace function public.contains_contact_info(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(p_text, '') ~* '[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+'
      or coalesce(p_text, '') ~ '(^|[^0-9])([+]?[0-9][[:space:]().-]?){8,}([^0-9]|$)';
$$;

revoke all on function public.contains_contact_info(text) from public, anon, authenticated;
grant execute on function public.contains_contact_info(text) to service_role;

alter table public.incidents
  add constraint incidents_public_title_no_contact
  check (public_title is null or not public.contains_contact_info(public_title)) not valid;
alter table public.incidents
  add constraint incidents_public_summary_no_contact
  check (public_summary is null or not public.contains_contact_info(public_summary)) not valid;
alter table public.source_items
  add constraint source_items_title_no_contact
  check (title is null or not public.contains_contact_info(title)) not valid;
alter table public.source_items
  add constraint source_items_summary_no_contact
  check (summary is null or not public.contains_contact_info(summary)) not valid;

-- A single atomic upsert per account/global bucket serializes concurrent inserts.
-- This avoids storing client IP addresses and applies even if a future route bypasses submit_flag().
create table public.flag_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  submission_count integer not null,
  max_count integer not null check (max_count in (10, 60)),
  constraint flag_rate_limits_count_check check (submission_count between 1 and max_count)
);
alter table public.flag_rate_limits enable row level security;
revoke all on table public.flag_rate_limits from public, anon, authenticated;
grant all on table public.flag_rate_limits to service_role;

create or replace function public.enforce_flag_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.flag_rate_limits (bucket_key, window_started_at, submission_count, max_count)
  values (
    case when new.flagged_by is null then 'anonymous-global' else 'account:' || new.flagged_by::text end,
    now(), 1, case when new.flagged_by is null then 60 else 10 end
  )
  on conflict (bucket_key) do update
    set window_started_at = case
          when public.flag_rate_limits.window_started_at <= now() - interval '1 hour' then now()
          else public.flag_rate_limits.window_started_at end,
        submission_count = case
          when public.flag_rate_limits.window_started_at <= now() - interval '1 hour' then 1
          else public.flag_rate_limits.submission_count + 1 end
    where public.flag_rate_limits.window_started_at <= now() - interval '1 hour'
       or public.flag_rate_limits.submission_count < public.flag_rate_limits.max_count;

  if not found then raise exception 'rate_limited'; end if;
  return new;
end;
$$;

revoke all on function public.enforce_flag_rate_limit() from public, anon, authenticated;
grant execute on function public.enforce_flag_rate_limit() to service_role;
create trigger content_flags_enforce_rate_limit
  before insert on public.content_flags
  for each row execute function public.enforce_flag_rate_limit();
