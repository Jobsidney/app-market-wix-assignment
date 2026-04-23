import { db } from "../lib/db.js";

export type SyncDirection = "wix_to_hubspot" | "hubspot_to_wix" | "bidirectional";

export interface FieldMappingRow {
  id: number;
  syncId: number;
  wixSiteId: string;
  wixField: string;
  hubspotField: string;
  syncDirection: SyncDirection;
  transformRule: string | null;
}

interface DbFieldMappingRow {
  id: number;
  sync_id: number;
  wix_site_id: string;
  wix_field: string;
  hubspot_field: string;
  sync_direction: SyncDirection;
  transform_rule: string | null;
}

function toModel(row: DbFieldMappingRow): FieldMappingRow {
  return {
    id: row.id,
    syncId: row.sync_id,
    wixSiteId: row.wix_site_id,
    wixField: row.wix_field,
    hubspotField: row.hubspot_field,
    syncDirection: row.sync_direction,
    transformRule: row.transform_rule,
  };
}

export async function listFieldMappings(wixSiteId: string, syncId: number): Promise<FieldMappingRow[]> {
  const result = await db.query<DbFieldMappingRow>(
    `select id, sync_id, wix_site_id, wix_field, hubspot_field, sync_direction, transform_rule
     from field_mappings
     where wix_site_id = $1 and sync_id = $2
     order by id asc`,
    [wixSiteId, syncId],
  );
  return result.rows.map(toModel);
}

export async function replaceFieldMappings(
  wixSiteId: string,
  syncId: number,
  mappings: Array<Omit<FieldMappingRow, "id" | "wixSiteId" | "syncId">>,
): Promise<FieldMappingRow[]> {
  await db.query("begin");
  try {
    await db.query("delete from field_mappings where wix_site_id = $1 and sync_id = $2", [wixSiteId, syncId]);
    for (const mapping of mappings) {
      await db.query(
        `insert into field_mappings (sync_id, wix_site_id, wix_field, hubspot_field, sync_direction, transform_rule)
         values ($1, $2, $3, $4, $5, $6)`,
        [syncId, wixSiteId, mapping.wixField, mapping.hubspotField, mapping.syncDirection, mapping.transformRule],
      );
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  return listFieldMappings(wixSiteId, syncId);
}
