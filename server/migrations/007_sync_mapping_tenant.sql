alter table sync_mapping add column if not exists wix_site_id text not null default '';

alter table sync_mapping drop constraint if exists sync_mapping_pkey;
alter table sync_mapping add primary key (wix_site_id, wix_contact_id);

create index if not exists idx_sync_mapping_hubspot
  on sync_mapping(wix_site_id, hubspot_contact_id);
