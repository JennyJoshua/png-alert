-- Permit trusted moderation to transition user-submitted sources after submission.
-- Initial user-submission values remain enforced by the INSERT RLS policy.
alter table public.external_sources
  drop constraint if exists external_sources_initial_submission_state;
