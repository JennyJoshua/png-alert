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

create or replace function public.submit_flag(p_user uuid, p_type text, p_target uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count bigint;
begin
  -- Serialize each bucket while counting and inserting so concurrent requests cannot
  -- race past the limit. Anonymous flags share a global bucket; no IP is persisted.
  if p_user is null then
    perform pg_advisory_xact_lock(hashtext('png-alert:anonymous-flags'));
    select count(*) into recent_count
      from content_flags
      where flagged_by is null and created_at > now() - interval '1 hour';
    if recent_count >= 60 then raise exception 'rate_limited'; end if;
  else
    perform pg_advisory_xact_lock(hashtext('png-alert:account-flags'), hashtext(p_user::text));
    select count(*) into recent_count
      from content_flags
      where flagged_by = p_user and created_at > now() - interval '1 hour';
    if recent_count >= 10 then raise exception 'rate_limited'; end if;
  end if;

  if p_type = 'incident' and not exists (
    select 1 from incidents where id = p_target and review_status = 'published'
  ) then raise exception 'not_found'; end if;
  if p_type = 'source_item' and not exists (
    select 1 from source_items where id = p_target and review_status = 'published'
  ) then raise exception 'not_found'; end if;

  insert into content_flags (target_type, target_id, reason, flagged_by)
  values (p_type, p_target, p_reason, p_user);
end;
$$;
