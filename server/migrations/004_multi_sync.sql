create table if not exists sync_definitions (
  id bigserial primary key,
  wix_site_id text not null,
  name text not null,
  hubspot_entity text not null default 'Contact',
  wix_entity text not null default 'Contact',
  sync_option text not null default 'existing_and_future',
  sync_direction text not null default 'bidirectional',
  existing_record_policy text not null default 'hubspot_to_wix',
  live boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_definitions_site on sync_definitions(wix_site_id);

insert into sync_definitions (wix_site_id, name)
select s.wix_site_id, 'HubSpot Contact ↔ Wix Contact'
from (
  select wix_site_id from oauth_installations
  union
  select wix_site_id from field_mappings
  union
  select wix_site_id from sync_jobs
  union
  select wix_site_id from form_submission_events
  union
  select wix_site_id from site_sync_state
) s
where not exists (
  select 1 from sync_definitions d where d.wix_site_id = s.wix_site_id
);

alter table field_mappings add column if not exists sync_id bigint;
update field_mappings fm
set sync_id = d.id
from sync_definitions d
where d.wix_site_id = fm.wix_site_id
  and fm.sync_id is null;
alter table field_mappings alter column sync_id set not null;
alter table field_mappings
  add constraint fk_field_mappings_sync_id
  foreign key (sync_id) references sync_definitions(id) on delete cascade;

drop index if exists idx_field_mappings_unique;
create unique index if not exists idx_field_mappings_unique
  on field_mappings(sync_id, wix_field, hubspot_field);

alter table sync_jobs add column if not exists sync_id bigint;
update sync_jobs sj
set sync_id = d.id
from sync_definitions d
where d.wix_site_id = sj.wix_site_id
  and sj.sync_id is null;
alter table sync_jobs alter column sync_id set not null;
alter table sync_jobs
  add constraint fk_sync_jobs_sync_id
  foreign key (sync_id) references sync_definitions(id) on delete cascade;
create index if not exists idx_sync_jobs_sync_id_status_created
  on sync_jobs(sync_id, status, created_at);

