-- Explicitly deny browser roles on Phase 2 private tables.
-- Schema and table grants already deny access; these policies make the RLS posture explicit.
create policy "deny browser access to social account connections"
  on private.social_account_connections
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "deny browser access to social OAuth attempts"
  on private.social_oauth_attempts
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "deny browser access to social connection events"
  on private.social_connection_events
  for all to anon, authenticated
  using (false)
  with check (false);
