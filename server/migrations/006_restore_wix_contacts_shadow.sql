create table if not exists wix_contacts_shadow (
  wix_contact_id text primary key,
  wix_site_id text not null,
  email text,
  first_name text,
  last_name text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
