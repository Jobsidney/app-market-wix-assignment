import { db } from "../lib/db.js";
import { assertValidWixMetaSiteId } from "../lib/wix-site-id.js";

export interface SyncDefinition {
  id: number;
  wixSiteId: string;
  name: string;
  hubspotEntity: string;
  wixEntity: string;
  syncOption: string;
  syncDirection: string;
  existingRecordPolicy: string;
  live: boolean;
  createdAt: string;
  updatedAt: string;
}

function buildAutoSyncName(direction: string, hubspotEntity: string, wixEntity: string): string {
  if (direction === "hubspot_to_wix") {
    return `HubSpot ${hubspotEntity} → Wix ${wixEntity}`;
  }
  if (direction === "wix_to_hubspot") {
    return `HubSpot ${hubspotEntity} ← Wix ${wixEntity}`;
  }
  return `HubSpot ${hubspotEntity} ↔ Wix ${wixEntity}`;
}

function isAutoSyncLabelPattern(name: string): boolean {
  return (
    /^HubSpot .+ (?:↔|<->) Wix .+( \d+)?$/i.test(name) ||
    /^HubSpot .+ (?:→|->) Wix .+( \d+)?$/i.test(name) ||
    /^HubSpot .+ (?:←|<-) Wix .+( \d+)?$/i.test(name) ||
    /^Wix .+ (?:→|->) HubSpot .+( \d+)?$/i.test(name)
  );
}

function isAutoSyncName(name: string): boolean {
  const trimmed = name.trim();
  return /^sync(?: \d+)?$/i.test(trimmed) || /^new sync(?: \d+)?$/i.test(trimmed) || isAutoSyncLabelPattern(trimmed);
}

function readNumericSuffix(name: string): string {
  const match = name.match(/ (\d+)$/);
  return match ? ` ${match[1]}` : "";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureUniqueSyncNameInSet(existingNames: Set<string>, desiredName: string): string {
  const normalizedDesiredName = desiredName.trim().toLowerCase();
  if (!existingNames.has(normalizedDesiredName)) {
    return desiredName;
  }
  const matcher = new RegExp(`^${escapeRegex(desiredName)}(?: (\\d+))?$`, "i");
  let maxSuffix = 1;
  for (const existingName of existingNames) {
    const match = existingName.match(matcher);
    if (!match) {
      continue;
    }
    const suffix = Number(match[1] ?? 1);
    if (Number.isFinite(suffix)) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }
  return `${desiredName} ${maxSuffix + 1}`;
}

async function ensureUniqueSyncName(wixSiteId: string, desiredName: string, excludeSyncId?: number): Promise<string> {
  const result = await db.query<{ name: string }>(
    `select name
       from sync_definitions
      where wix_site_id = $1
        and ($2::bigint is null or id <> $2)`,
    [wixSiteId, excludeSyncId ?? null],
  );
  const existingNames = new Set(result.rows.map((row) => row.name.trim().toLowerCase()));
  if (!existingNames.has(desiredName.trim().toLowerCase())) {
    return desiredName;
  }
  const matcher = new RegExp(`^${escapeRegex(desiredName)}(?: (\\d+))?$`, "i");
  let maxSuffix = 1;
  for (const { name } of result.rows) {
    const match = name.trim().match(matcher);
    if (!match) {
      continue;
    }
    const suffix = Number(match[1] ?? 1);
    if (Number.isFinite(suffix)) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }
  return `${desiredName} ${maxSuffix + 1}`;
}

interface SyncDefinitionRow {
  id: number;
  wix_site_id: string;
  name: string;
  hubspot_entity: string;
  wix_entity: string;
  sync_option: string;
  sync_direction: string;
  existing_record_policy: string;
  live: boolean;
  created_at: string;
  updated_at: string;
}

async function normalizeAutoSyncNames(wixSiteId: string): Promise<void> {
  const result = await db.query<SyncDefinitionRow>(
    `select id, wix_site_id, name, hubspot_entity, wix_entity, sync_option,
            sync_direction, existing_record_policy, live, created_at, updated_at
     from sync_definitions
     where wix_site_id = $1
     order by created_at asc, id asc`,
    [wixSiteId],
  );
  const usedNames = new Set(result.rows.map((row) => row.name.trim().toLowerCase()));
  for (const row of result.rows) {
    if (!isAutoSyncName(row.name)) {
      continue;
    }
    const desiredName = `${buildAutoSyncName(row.sync_direction, row.hubspot_entity, row.wix_entity)}${readNumericSuffix(row.name)}`;
    if (row.name.trim().toLowerCase() === desiredName.trim().toLowerCase()) {
      continue;
    }
    usedNames.delete(row.name.trim().toLowerCase());
    const nextName = ensureUniqueSyncNameInSet(usedNames, desiredName);
    usedNames.add(nextName.trim().toLowerCase());
    await db.query(
      `update sync_definitions
       set name = $3
       where wix_site_id = $1 and id = $2`,
      [wixSiteId, row.id, nextName],
    );
  }
}

function toModel(row: SyncDefinitionRow): SyncDefinition {
  return {
    id: row.id,
    wixSiteId: row.wix_site_id,
    name: row.name,
    hubspotEntity: row.hubspot_entity,
    wixEntity: row.wix_entity,
    syncOption: row.sync_option,
    syncDirection: row.sync_direction,
    existingRecordPolicy: row.existing_record_policy,
    live: row.live,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSyncDefinitions(wixSiteId: string): Promise<SyncDefinition[]> {
  await normalizeAutoSyncNames(wixSiteId);
  const result = await db.query<SyncDefinitionRow>(
    `select id, wix_site_id, name, hubspot_entity, wix_entity, sync_option,
            sync_direction, existing_record_policy, live, created_at, updated_at
     from sync_definitions
     where wix_site_id = $1
     order by created_at asc`,
    [wixSiteId],
  );
  return result.rows.map(toModel);
}

export async function getSyncDefinitionById(wixSiteId: string, syncId: number): Promise<SyncDefinition | null> {
  await normalizeAutoSyncNames(wixSiteId);
  const result = await db.query<SyncDefinitionRow>(
    `select id, wix_site_id, name, hubspot_entity, wix_entity, sync_option,
            sync_direction, existing_record_policy, live, created_at, updated_at
     from sync_definitions
     where wix_site_id = $1 and id = $2`,
    [wixSiteId, syncId],
  );
  return result.rows[0] ? toModel(result.rows[0]) : null;
}

export async function createSyncDefinition(wixSiteId: string, name: string): Promise<SyncDefinition> {
  assertValidWixMetaSiteId(wixSiteId, "createSyncDefinition");
  const nextName = await ensureUniqueSyncName(wixSiteId, name);
  const result = await db.query<SyncDefinitionRow>(
    `insert into sync_definitions (wix_site_id, name)
     values ($1, $2)
     returning id, wix_site_id, name, hubspot_entity, wix_entity, sync_option,
               sync_direction, existing_record_policy, live, created_at, updated_at`,
    [wixSiteId, nextName],
  );
  const created = result.rows[0];
  if (!created) {
    throw new Error("Failed to create sync definition");
  }
  return toModel(created);
}

export async function updateSyncDefinition(
  wixSiteId: string,
  syncId: number,
  patch: Partial<
    Pick<
      SyncDefinition,
      "name" | "live" | "syncOption" | "syncDirection" | "existingRecordPolicy" | "hubspotEntity" | "wixEntity"
    >
  >,
): Promise<SyncDefinition | null> {
  const existing = await getSyncDefinitionById(wixSiteId, syncId);
  if (!existing) {
    return null;
  }
  const nextDirection = patch.syncDirection ?? existing.syncDirection;
  const nextHubspotEntity = patch.hubspotEntity ?? existing.hubspotEntity;
  const nextWixEntity = patch.wixEntity ?? existing.wixEntity;
  let nextName = patch.name ?? existing.name;
  if (!patch.name && isAutoSyncName(existing.name)) {
    nextName = await ensureUniqueSyncName(
      wixSiteId,
      `${buildAutoSyncName(nextDirection, nextHubspotEntity, nextWixEntity)}${readNumericSuffix(existing.name)}`,
      syncId,
    );
  }
  const result = await db.query<SyncDefinitionRow>(
    `update sync_definitions
     set name = $3,
         live = $4,
         sync_option = $5,
         sync_direction = $6,
         existing_record_policy = $7,
      hubspot_entity = $8,
      wix_entity = $9,
         updated_at = now()
     where wix_site_id = $1 and id = $2
     returning id, wix_site_id, name, hubspot_entity, wix_entity, sync_option,
               sync_direction, existing_record_policy, live, created_at, updated_at`,
    [
      wixSiteId,
      syncId,
      nextName,
      patch.live ?? existing.live,
      patch.syncOption ?? existing.syncOption,
      nextDirection,
      patch.existingRecordPolicy ?? existing.existingRecordPolicy,
      nextHubspotEntity,
      nextWixEntity,
    ],
  );
  return result.rows[0] ? toModel(result.rows[0]) : null;
}

export async function deleteSyncDefinition(wixSiteId: string, syncId: number): Promise<boolean> {
  const result = await db.query("delete from sync_definitions where wix_site_id = $1 and id = $2", [wixSiteId, syncId]);
  return Boolean(result.rowCount);
}

export async function getDefaultSyncId(wixSiteId: string): Promise<number> {
  assertValidWixMetaSiteId(wixSiteId, "getDefaultSyncId");
  const existing = await db.query<{ id: number }>(
    "select id from sync_definitions where wix_site_id = $1 order by created_at asc limit 1",
    [wixSiteId],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }
  const created = await createSyncDefinition(wixSiteId, "HubSpot Contact ↔ Wix Contact");
  return created.id;
}

export async function getSyncLiveEnabled(syncId: number): Promise<boolean> {
  const result = await db.query<{ live: boolean }>("select live from sync_definitions where id = $1", [syncId]);
  return result.rows[0]?.live ?? true;
}

