import { db } from "../lib/db.js";
import type { SyncMapping, SyncSource } from "../types/sync.js";

interface SyncMappingRow {
  wix_contact_id: string;
  hubspot_contact_id: string;
  last_synced_at: string;
  last_sync_source: SyncSource;
  correlation_id: string | null;
}

function toSyncMapping(row: SyncMappingRow): SyncMapping {
  return {
    wixContactId: row.wix_contact_id,
    hubspotContactId: row.hubspot_contact_id,
    lastSyncedAt: row.last_synced_at,
    lastSyncSource: row.last_sync_source,
    correlationId: row.correlation_id,
  };
}

export async function getSyncMappingByWixId(wixContactId: string): Promise<SyncMapping | null> {
  const result = await db.query<SyncMappingRow>(
    "select * from sync_mapping where wix_contact_id = $1",
    [wixContactId],
  );
  return result.rows[0] ? toSyncMapping(result.rows[0]) : null;
}

export async function getSyncMappingByHubspotId(hubspotContactId: string): Promise<SyncMapping | null> {
  const result = await db.query<SyncMappingRow>(
    "select * from sync_mapping where hubspot_contact_id = $1 order by updated_at desc limit 1",
    [hubspotContactId],
  );
  return result.rows[0] ? toSyncMapping(result.rows[0]) : null;
}

export async function deleteSyncMappingByWixContactId(wixContactId: string): Promise<void> {
  await db.query("delete from sync_mapping where wix_contact_id = $1", [wixContactId]);
}

export async function upsertSyncMapping(mapping: SyncMapping): Promise<void> {
  await db.query(
    `insert into sync_mapping (wix_contact_id, hubspot_contact_id, last_synced_at, last_sync_source, correlation_id)
     values ($1, $2, $3, $4, $5)
     on conflict (wix_contact_id)
     do update set hubspot_contact_id = excluded.hubspot_contact_id,
                   last_synced_at = excluded.last_synced_at,
                   last_sync_source = excluded.last_sync_source,
                   correlation_id = excluded.correlation_id`,
    [
      mapping.wixContactId,
      mapping.hubspotContactId,
      mapping.lastSyncedAt,
      mapping.lastSyncSource,
      mapping.correlationId ?? null,
    ],
  );
}
