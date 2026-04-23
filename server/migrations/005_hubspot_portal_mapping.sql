alter table oauth_installations add column if not exists hubspot_portal_id text;

create unique index if not exists idx_oauth_installations_hubspot_portal_id
  on oauth_installations(hubspot_portal_id)
  where hubspot_portal_id is not null;
