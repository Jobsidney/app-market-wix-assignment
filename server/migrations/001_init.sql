create table if not exists oauth_installations (
  wix_site_id text primary key,
  access_token text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_mapping (
  wix_contact_id text primary key,
  hubspot_contact_id text not null,
  last_synced_at timestamptz not null,
  last_sync_source text not null check (last_sync_source in ('wix', 'hubspot')),
  correlation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_mapping_hubspot_contact_id on sync_mapping(hubspot_contact_id);

create table if not exists field_mappings (
  id bigserial primary key,
  wix_site_id text not null,
  wix_field text not null,
  hubspot_field text not null,
  sync_direction text not null check (sync_direction in ('wix_to_hubspot', 'hubspot_to_wix', 'bidirectional')),
  transform_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_field_mappings_unique
  on field_mappings(wix_site_id, wix_field, hubspot_field);

create table if not exists sync_jobs (
  id bigserial primary key,
  wix_site_id text not null,
  job_type text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_jobs_status_created
  on sync_jobs(status, created_at);

create table if not exists form_submission_events (
  id bigserial primary key,
  wix_site_id text not null,
  wix_submission_id text not null,
  wix_contact_id text,
  page_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (wix_site_id, wix_submission_id)
);

create table if not exists wix_contacts_shadow (
  wix_contact_id text primary key,
  wix_site_id text not null,
  email text,
  first_name text,
  last_name text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
