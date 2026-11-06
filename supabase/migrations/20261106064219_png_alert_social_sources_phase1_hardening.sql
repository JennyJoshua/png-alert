-- PNG Alert Phase 1 hardening: explicit grants, deny policies and index/policy cleanup.

revoke all on public.social_providers from anon, authenticated;
revoke all on public.social_provider_capabilities from anon, authenticated;
revoke all on public.external_sources from anon, authenticated;
revoke all on public.external_source_verifications from anon, authenticated;
revoke all on public.external_source_metadata_history from anon, authenticated;
revoke all on public.external_source_reports from anon, authenticated;
revoke all on public.social_share_events from anon, authenticated;

grant select on public.social_providers to anon, authenticated;
grant select on public.social_provider_capabilities to anon, authenticated;
grant select, insert on public.external_sources to authenticated;
grant select on public.external_sources to anon;
grant select, insert on public.external_source_reports to authenticated;
grant select, insert on public.social_share_events to authenticated;

drop policy if exists "public accepted sources are readable" on public.external_sources;
drop policy if exists "submitters can read their own sources" on public.external_sources;

create policy "users can read public sources or their own submissions"
  on public.external_sources for select to anon, authenticated
  using (
    (submission_status = 'accepted' and visibility_status = 'public')
    or (auth.uid() is not null and submitted_by = (select auth.uid()))
  );

create policy "verification history is backend only"
  on public.external_source_verifications for all to anon, authenticated
  using (false) with check (false);

create policy "metadata history is backend only"
  on public.external_source_metadata_history for all to anon, authenticated
  using (false) with check (false);

create index external_source_reports_reviewed_by_idx
  on public.external_source_reports(reviewed_by);
create index external_source_verifications_reviewed_by_idx
  on public.external_source_verifications(reviewed_by);
create index social_share_events_source_id_idx
  on public.social_share_events(source_id);
