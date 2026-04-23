create table if not exists site_sync_state (
  wix_site_id text primary key,
  live boolean not null default true,
  updated_at timestamptz not null default now()
);
