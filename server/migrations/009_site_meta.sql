create table if not exists site_meta (
  wix_site_id    text primary key,
  wix_meta_site_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
