-- PNG Alert Phase 1: social provider registry, external sources, verification, reporting and sharing.
-- No OAuth credentials, identity connections or publishing jobs are created in this phase.

create table public.social_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  website_url text,
  enabled boolean not null default true,
  identity_supported boolean not null default false,
  sharing_supported boolean not null default true,
  publishing_supported boolean not null default false,
  metadata_supported boolean not null default false,
  capability_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_provider_capabilities (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.social_providers(id) on delete cascade,
  capability_code text not null check (capability_code in ('identity','sharing','publishing','metadata')),
  availability_status text not null check (availability_status in ('available','conditional','unavailable')),
  required_scopes text[] not null default '{}',
  approval_required boolean not null default false,
  account_type_requirement text,
  cost_notes text,
  restrictions text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_id, capability_code)
);

create table public.external_sources (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  provider_id uuid references public.social_providers(id) on delete set null,
  source_url text not null check (length(source_url) between 1 and 4096),
  canonical_url text,
  domain text,
  source_type text not null default 'other'
    check (source_type in ('news','social_post','video','blog','website','document','other')),
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  submission_status text not null default 'pending'
    check (submission_status in ('pending','accepted','rejected','removed')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','under_review','verified','partially_verified','disputed','rejected','unavailable')),
  visibility_status text not null default 'restricted'
    check (visibility_status in ('public','restricted','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_sources_initial_submission_state
    check (
      submitted_by is null
      or (submission_status = 'pending' and verification_status = 'unverified' and visibility_status = 'restricted')
    )
);

create table public.external_source_verifications (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  verification_type text not null check (verification_type in ('manual','automated','editorial','corroboration')),
  previous_status text check (previous_status in ('unverified','under_review','verified','partially_verified','disputed','rejected','unavailable')),
  new_status text not null check (new_status in ('unverified','under_review','verified','partially_verified','disputed','rejected','unavailable')),
  evidence_summary text,
  evidence_url text,
  reviewer_notes text,
  reviewed_at timestamptz not null default now()
);

create table public.external_source_metadata_history (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources(id) on delete restrict,
  title text,
  description text,
  thumbnail_url text,
  retrieval_status text not null check (retrieval_status in ('successful','failed','blocked','unavailable')),
  retrieved_at timestamptz not null default now()
);

create table public.external_source_reports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  report_reason text not null check (report_reason in ('misleading','malicious','broken','inappropriate','duplicate','other')),
  report_description text,
  report_status text not null default 'pending'
    check (report_status in ('pending','reviewing','resolved','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.social_share_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.social_providers(id) on delete restrict,
  source_id uuid references public.external_sources(id) on delete set null,
  share_method text not null check (share_method in ('native_share_sheet','share_url','copied_link','other')),
  share_status text not null default 'initiated'
    check (share_status in ('initiated','handed_off','failed','unknown')),
  created_at timestamptz not null default now()
);

create index social_provider_capabilities_provider_idx
  on public.social_provider_capabilities(provider_id);
create index external_sources_submitter_created_idx
  on public.external_sources(submitted_by, created_at desc);
create index external_sources_public_status_idx
  on public.external_sources(submission_status, visibility_status, created_at desc);
create index external_sources_provider_idx on public.external_sources(provider_id);
create index external_sources_domain_idx on public.external_sources(domain);
create unique index external_sources_canonical_url_uidx
  on public.external_sources(canonical_url) where canonical_url is not null;
create index external_source_verifications_source_date_idx
  on public.external_source_verifications(source_id, reviewed_at desc);
create index external_source_metadata_history_source_date_idx
  on public.external_source_metadata_history(source_id, retrieved_at desc);
create index external_source_reports_source_status_idx
  on public.external_source_reports(source_id, report_status, created_at desc);
create index external_source_reports_reporter_idx
  on public.external_source_reports(reported_by, created_at desc);
create index social_share_events_user_date_idx
  on public.social_share_events(user_id, created_at desc);
create index social_share_events_provider_date_idx
  on public.social_share_events(provider_id, created_at desc);

alter table public.social_providers enable row level security;
alter table public.social_provider_capabilities enable row level security;
alter table public.external_sources enable row level security;
alter table public.external_source_verifications enable row level security;
alter table public.external_source_metadata_history enable row level security;
alter table public.external_source_reports enable row level security;
alter table public.social_share_events enable row level security;

grant select on public.social_providers to anon, authenticated;
grant select on public.social_provider_capabilities to anon, authenticated;
grant select on public.external_sources to anon, authenticated;
grant insert on public.external_sources to authenticated;
grant select, insert on public.external_source_reports to authenticated;
grant select, insert on public.social_share_events to authenticated;

create policy "providers are publicly readable"
  on public.social_providers for select to anon, authenticated
  using (enabled = true);

create policy "provider capabilities are publicly readable"
  on public.social_provider_capabilities for select to anon, authenticated
  using (
    exists (
      select 1 from public.social_providers p
      where p.id = provider_id and p.enabled = true
    )
  );

create policy "public accepted sources are readable"
  on public.external_sources for select to anon, authenticated
  using (submission_status = 'accepted' and visibility_status = 'public');

create policy "submitters can read their own sources"
  on public.external_sources for select to authenticated
  using (submitted_by = (select auth.uid()));

create policy "authenticated users can submit pending sources"
  on public.external_sources for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and submission_status = 'pending'
    and verification_status = 'unverified'
    and visibility_status = 'restricted'
  );

create policy "users can submit source reports"
  on public.external_source_reports for insert to authenticated
  with check (
    reported_by = (select auth.uid())
    and report_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.external_sources s
      where s.id = source_id
        and (
          (s.submission_status = 'accepted' and s.visibility_status = 'public')
          or s.submitted_by = (select auth.uid())
        )
    )
  );

create policy "users can read their own source reports"
  on public.external_source_reports for select to authenticated
  using (reported_by = (select auth.uid()));

create policy "users can create their own share events"
  on public.social_share_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and share_status = 'initiated'
    and exists (
      select 1 from public.social_providers p
      where p.id = provider_id and p.enabled = true and p.sharing_supported = true
    )
    and (
      source_id is null
      or exists (
        select 1 from public.external_sources s
        where s.id = source_id
          and (
            (s.submission_status = 'accepted' and s.visibility_status = 'public')
            or s.submitted_by = (select auth.uid())
          )
      )
    )
  );

create policy "users can read their own share events"
  on public.social_share_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Verification history and metadata history intentionally have no anon/authenticated grants or policies.
-- Moderation and metadata ingestion are reserved for trusted server-side operations.

insert into public.social_providers
  (code, name, website_url, enabled, identity_supported, sharing_supported, publishing_supported, metadata_supported, capability_notes)
values
  ('facebook','Facebook','https://www.facebook.com',true,true,true,true,true,'Identity and publishing depend on Meta permissions and app review.'),
  ('instagram','Instagram','https://www.instagram.com',true,true,true,true,true,'Official identity and publishing APIs are limited to eligible professional accounts and approved permissions.'),
  ('whatsapp','WhatsApp','https://www.whatsapp.com',true,false,true,true,false,'Ordinary consumer sharing is supported; business messaging is a separate integration and may incur charges.'),
  ('tiktok','TikTok','https://www.tiktok.com',true,true,true,true,true,'Direct publishing requires the appropriate scopes and may require a successful app audit.'),
  ('x','X','https://x.com',true,true,true,true,true,'API access and publishing may incur usage-based charges; API publishing is not enabled in Phase 1.'),
  ('youtube','YouTube','https://www.youtube.com',true,true,true,true,true,'Google OAuth, API quotas and publishing authorization apply.'),
  ('linkedin','LinkedIn','https://www.linkedin.com',true,true,true,true,true,'Member publishing requires the appropriate product access and w_member_social permission.');

insert into public.social_provider_capabilities
  (provider_id, capability_code, availability_status, required_scopes, approval_required, account_type_requirement, cost_notes, restrictions, reviewed_at)
select p.id, c.capability_code, c.availability_status, c.required_scopes, c.approval_required,
       c.account_type_requirement, c.cost_notes, c.restrictions, now()
from public.social_providers p
join (values
  ('facebook','identity','conditional',array[]::text[],true,'Facebook account','No known per-share API fee; app review may apply','Permissions and app review required for production access.'),
  ('facebook','sharing','available',array[]::text[],false,'Any supported user account','No PNG Alert API publishing fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('facebook','publishing','conditional',array[]::text[],true,'Eligible Page/account','API access conditions apply','Requires provider-specific permissions and app review.'),
  ('facebook','metadata','conditional',array[]::text[],true,'Public content where permitted','API access conditions apply','Only permitted public metadata may be retrieved.'),
  ('instagram','identity','conditional',array[]::text[],true,'Professional Business or Creator account','No assumed free unrestricted access','Personal consumer accounts are not supported by the relevant professional API flow.'),
  ('instagram','sharing','available',array[]::text[],false,'Any supported user account','No PNG Alert API publishing fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('instagram','publishing','conditional',array[]::text[],true,'Professional Business or Creator account','API access conditions apply','Professional account and approved permissions required.'),
  ('instagram','metadata','conditional',array[]::text[],true,'Eligible professional/public content','API access conditions apply','Access is restricted by account type and platform policy.'),
  ('whatsapp','identity','unavailable',array[]::text[],false,'Ordinary consumer account','Not applicable','No general-purpose consumer identity OAuth integration assumed.'),
  ('whatsapp','sharing','available',array[]::text[],false,'Any supported user account','No API fee for user-controlled link sharing','Opens WhatsApp sharing through supported user-driven mechanisms.'),
  ('whatsapp','publishing','conditional',array[]::text[],true,'WhatsApp Business Platform account','Business messaging may incur charges','Business Platform messaging is separate from consumer link sharing.'),
  ('whatsapp','metadata','unavailable',array[]::text[],false,'Ordinary consumer content','Not applicable','No general consumer content metadata API assumed.'),
  ('tiktok','identity','conditional',array[]::text[],true,'TikTok account','API access conditions apply','OAuth scopes and app review may apply.'),
  ('tiktok','sharing','available',array[]::text[],false,'Any supported user account','No PNG Alert API publishing fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('tiktok','publishing','conditional',array['video.publish']::text[],true,'Authorized TikTok account','No paid API dependency approved','Unaudited clients have private-only restrictions; public publishing requires audit.'),
  ('tiktok','metadata','conditional',array[]::text[],true,'Authorized or permitted public content','API access conditions apply','Only permitted metadata and scopes may be used.'),
  ('x','identity','conditional',array[]::text[],true,'X account','API plan/access conditions apply','OAuth and current developer access requirements apply.'),
  ('x','sharing','available',array[]::text[],false,'Any supported user account','No API fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('x','publishing','conditional',array[]::text[],true,'Authorized X account','Usage-based API charges may apply','Do not enable API publishing without separate cost approval.'),
  ('x','metadata','conditional',array[]::text[],true,'Public content within API access','Usage-based API charges may apply','Access and cost depend on current X API plan.'),
  ('youtube','identity','conditional',array[]::text[],true,'Google/YouTube account','OAuth verification and quota considerations','Use Google OAuth; do not enable social login for PNG Alert.'),
  ('youtube','sharing','available',array[]::text[],false,'Any supported user account','No API fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('youtube','publishing','conditional',array[]::text[],true,'Authorized YouTube channel','Quota and verification requirements','Upload/publishing requires explicit channel authorization.'),
  ('youtube','metadata','conditional',array[]::text[],true,'Public YouTube content','API quota consumption','Use permitted YouTube Data API operations and quotas.'),
  ('linkedin','identity','available',array[]::text[],false,'LinkedIn member','Product access requirements apply','OpenID Connect identity capabilities.'),
  ('linkedin','sharing','available',array[]::text[],false,'Any supported user account','No API fee for user-driven sharing','Uses user-controlled platform sharing.'),
  ('linkedin','publishing','conditional',array['w_member_social']::text[],true,'Authorized LinkedIn member','Product access requirements apply','Member publishing requires w_member_social and product access.'),
  ('linkedin','metadata','conditional',array[]::text[],true,'Permitted public/member content','Product access requirements apply','Only data permitted by LinkedIn products and policies.')
) as c(provider_code, capability_code, availability_status, required_scopes, approval_required, account_type_requirement, cost_notes, restrictions)
on p.code = c.provider_code;
