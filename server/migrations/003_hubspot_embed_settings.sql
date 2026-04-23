create table if not exists hubspot_embed_settings (
  wix_site_id text primary key,
  portal_id text not null,
  form_id text not null,
  region text not null default 'na1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
