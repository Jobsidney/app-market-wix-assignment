import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { deepEqual } from "./idempotency.js";
import { listFieldMappings } from "./field-mapping-repo.js";
import {
  deleteSyncMappingByWixContactId,
  getSyncMappingByHubspotId,
  getSyncMappingByWixId,
  upsertSyncMapping,
} from "./sync-mapping-repo.js";
import { transformByPersistedMappings } from "./mapping-transformer.js";
import { getHubspotContactProperties, upsertHubspotContact } from "./hubspot-contacts.js";
import {
  applyInboundHubspotToWixContact,
  createWixContactFromHubspotPayload,
  findWixContactIdByPrimaryEmail,
  hasWixContact,
} from "./wix-contacts-api.js";

interface IncomingEvent {
  wixSiteId: string;
  syncId: number;
  wixContactId?: string;
  hubspotContactId?: string;
  correlationId?: string;
  source: "wix" | "hubspot";
  payload: Record<string, unknown>;
  currentRemoteState?: Record<string, unknown>;
  updatedAt?: string;
}

function pickFirstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function buildWixFallbackHubspotPayload(payload: Record<string, unknown>): Record<string, string> {
  const email = pickFirstString(payload.email, payload.primaryEmail);
  const firstname = pickFirstString(payload.firstName, payload.firstname);
  const lastname = pickFirstString(payload.lastName, payload.lastname);
  const phone = pickFirstString(payload.phone, payload.mobilePhone);
  const fallback: Record<string, string> = {};
  if (email) fallback.email = email;
  if (firstname) fallback.firstname = firstname;
  if (lastname) fallback.lastname = lastname;
  if (phone) fallback.phone = phone;
  return fallback;
}

function mergeMissingHubspotContactBasics(
  outbound: Record<string, unknown>,
  sourcePayload: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...outbound };
  const outboundEmail = pickFirstString(merged.email, merged.primaryEmail);
  const outboundFirstName = pickFirstString(merged.firstname, merged.firstName);
  const outboundLastName = pickFirstString(merged.lastname, merged.lastName);
  const outboundPhone = pickFirstString(merged.phone, merged.mobilePhone);

  if (!outboundEmail) {
    const fallbackEmail = pickFirstString(sourcePayload.email, sourcePayload.primaryEmail);
    if (fallbackEmail) {
      merged.email = fallbackEmail;
    }
  }
  if (!outboundFirstName) {
    const fallbackFirstName = pickFirstString(sourcePayload.firstname, sourcePayload.firstName);
    if (fallbackFirstName) {
      merged.firstname = fallbackFirstName;
    }
  }
  if (!outboundLastName) {
    const fallbackLastName = pickFirstString(sourcePayload.lastname, sourcePayload.lastName);
    if (fallbackLastName) {
      merged.lastname = fallbackLastName;
    }
  }
  if (!outboundPhone) {
    const fallbackPhone = pickFirstString(sourcePayload.phone, sourcePayload.mobilePhone);
    if (fallbackPhone) {
      merged.phone = fallbackPhone;
    }
  }
  return merged;
}

function mergeMissingWixContactBasics(
  outbound: Record<string, unknown>,
  sourcePayload: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...outbound };
  const outboundEmail = pickFirstString(merged.email, merged.primaryEmail);
  const outboundFirstName = pickFirstString(merged.firstname, merged.firstName);
  const outboundLastName = pickFirstString(merged.lastname, merged.lastName);
  const outboundPhone = pickFirstString(merged.phone, merged.mobilePhone);

  if (!outboundEmail) {
    const fallbackEmail = pickFirstString(sourcePayload.email, sourcePayload.primaryEmail);
    if (fallbackEmail) {
      merged.email = fallbackEmail;
    }
  }
  if (!outboundFirstName) {
    const fallbackFirstName = pickFirstString(sourcePayload.firstName, sourcePayload.firstname);
    if (fallbackFirstName) {
      merged.firstname = fallbackFirstName;
    }
  }
  if (!outboundLastName) {
    const fallbackLastName = pickFirstString(sourcePayload.lastName, sourcePayload.lastname);
    if (fallbackLastName) {
      merged.lastname = fallbackLastName;
    }
  }
  if (!outboundPhone) {
    const fallbackPhone = pickFirstString(sourcePayload.phone, sourcePayload.mobilePhone);
    if (fallbackPhone) {
      merged.phone = fallbackPhone;
    }
  }
  return merged;
}

function getNestedString(source: unknown, path: string): string {
  if (!source || typeof source !== "object") {
    return "";
  }
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current.trim() : "";
}

function parseObjectLikeJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT_ID_KEY_HINTS = new Set(["entityid", "wixcontactid", "contactid"]);

function deepFindContactId(source: unknown, depth = 0): string {
  if (depth > 6 || !source) {
    return "";
  }
  if (typeof source === "string") {
    return UUID_PATTERN.test(source.trim()) ? source.trim() : "";
  }
  if (Array.isArray(source)) {
    for (const item of source) {
      const hit = deepFindContactId(item, depth + 1);
      if (hit) {
        return hit;
      }
    }
    return "";
  }
  if (typeof source !== "object") {
    return "";
  }
  for (const [rawKey, value] of Object.entries(source as Record<string, unknown>)) {
    const key = rawKey.replace(/[\s_-]/g, "").toLowerCase();
    if (CONTACT_ID_KEY_HINTS.has(key) && typeof value === "string" && UUID_PATTERN.test(value.trim())) {
      return value.trim();
    }
    if (typeof value === "string") {
      const nested = parseObjectLikeJson(value);
      if (nested) {
        const hit = deepFindContactId(nested, depth + 1);
        if (hit) {
          return hit;
        }
      }
    }
  }
  for (const value of Object.values(source as Record<string, unknown>)) {
    if (value && (typeof value === "object" || Array.isArray(value))) {
      const hit = deepFindContactId(value, depth + 1);
      if (hit) {
        return hit;
      }
    }
  }
  return "";
}

function extractWixContactId(payload: Record<string, unknown>, fallbackId?: string): string {
  const bodyData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
  const nestedEvent = parseObjectLikeJson(bodyData?.data) ?? parseObjectLikeJson(payload.data);
  const directMatch =
    pickFirstString(
      fallbackId,
      payload.wixContactId,
      payload.contactId,
      payload.entityId,
      bodyData?.wixContactId,
      bodyData?.entityId,
      getNestedString(payload, "payload.wixContactId"),
      getNestedString(payload, "payload.entityId"),
      getNestedString(payload, "contact.id"),
      getNestedString(payload, "contact.contactId"),
      getNestedString(payload, "updatedEvent.currentEntity.id"),
      getNestedString(payload, "updatedEvent.entity.id"),
      getNestedString(payload, "createdEvent.currentEntity.id"),
      getNestedString(payload, "createdEvent.entity.id"),
      nestedEvent?.entityId,
      getNestedString(nestedEvent, "updatedEvent.currentEntity.id"),
      getNestedString(nestedEvent, "updatedEvent.entity.id"),
      getNestedString(nestedEvent, "createdEvent.currentEntity.id"),
      getNestedString(nestedEvent, "createdEvent.entity.id"),
    ) ?? "";
  if (directMatch) {
    return directMatch;
  }
  const combinedSources: unknown[] = [payload, bodyData, nestedEvent];
  for (const source of combinedSources) {
    const hit = deepFindContactId(source);
    if (hit) {
      return hit;
    }
  }
  return "";
}

function outboundEmailForLookup(outbound: Record<string, unknown>): string | undefined {
  if (typeof outbound.email === "string" && outbound.email.trim()) {
    return outbound.email.trim().toLowerCase();
  }
  const primary = outbound.primaryInfo;
  if (primary && typeof primary === "object" && !Array.isArray(primary)) {
    const e = (primary as Record<string, unknown>).email;
    if (typeof e === "string" && e.trim()) {
      return e.trim().toLowerCase();
    }
  }
  return undefined;
}

export async function processSyncEvent(event: IncomingEvent): Promise<void> {
  const resolvedWixContactId = extractWixContactId(event.payload, event.wixContactId);
  if (event.source === "wix" && !resolvedWixContactId) {
    const payloadKeys = Object.keys(event.payload ?? {});
    const snippet = (() => {
      try {
        return JSON.stringify(event.payload).slice(0, 400);
      } catch {
        return "<unserializable>";
      }
    })();
    logger.warn({ payloadKeys, snippet, syncId: event.syncId }, "Missing wixContactId: payload shape diagnostic");
    throw new Error(`Missing wixContactId in sync event (keys: ${payloadKeys.join(",") || "<none>"})`);
  }
  if (event.correlationId?.startsWith(env.APP_INTERNAL_ID)) {
    logger.info({ wixContactId: resolvedWixContactId }, "Loop prevention: ignored internal correlation id");
    return;
  }

  const hubspotContactId = event.hubspotContactId?.trim() || undefined;
  let wixContactId = resolvedWixContactId;

  let mapping = wixContactId ? await getSyncMappingByWixId(wixContactId) : null;
  if (!mapping && hubspotContactId) {
    mapping = await getSyncMappingByHubspotId(hubspotContactId);
    if (mapping && !wixContactId) {
      wixContactId = mapping.wixContactId;
    }
  }

  if (event.source === "wix") {
    const eventUpdatedAt = event.updatedAt ? new Date(event.updatedAt).getTime() : Date.now();
    const lastSyncedAt = mapping ? new Date(mapping.lastSyncedAt).getTime() : 0;
    if (lastSyncedAt && eventUpdatedAt <= lastSyncedAt) {
      logger.info({ wixContactId: wixContactId || hubspotContactId }, "Conflict handling: skipped older Wix-originated event");
      return;
    }
  }

  const fieldRows = await listFieldMappings(event.wixSiteId, event.syncId);
  let sourcePayload = event.payload;
  if (event.source === "hubspot" && hubspotContactId) {
    const requestedProps = Array.from(
      new Set([
        ...fieldRows.map((row) => row.hubspotField),
        "email",
        "firstname",
        "lastname",
        "phone",
      ]),
    );
    const enriched = await getHubspotContactProperties(event.wixSiteId, hubspotContactId, requestedProps);
    if (enriched) {
      sourcePayload = { ...enriched, ...event.payload };
    }
  }
  const transformed =
    event.source === "wix"
      ? transformByPersistedMappings(sourcePayload, fieldRows, "wix_to_hubspot")
      : transformByPersistedMappings(sourcePayload, fieldRows, "hubspot_to_wix");

  let outbound =
    event.source === "hubspot"
      ? mergeMissingHubspotContactBasics(transformed, sourcePayload)
      : mergeMissingWixContactBasics(transformed, sourcePayload);
  if (Object.keys(outbound).length === 0 && event.source === "wix") {
    outbound = buildWixFallbackHubspotPayload(sourcePayload);
  }
  if (Object.keys(outbound).length === 0) {
    throw new Error(`No mapped fields available for ${event.source} sync event`);
  }

  if (event.currentRemoteState && deepEqual(outbound, event.currentRemoteState)) {
    logger.info({ wixContactId: wixContactId || hubspotContactId }, "Idempotency: no-op update skipped");
    return;
  }

  if (event.source === "wix") {
    const wixId = wixContactId;
    let hubspotId = mapping?.hubspotContactId ?? hubspotContactId ?? "";
    hubspotId = await upsertHubspotContact(event.wixSiteId, outbound, hubspotId || undefined);
    await upsertSyncMapping({
      wixContactId: wixId,
      hubspotContactId: hubspotId,
      lastSyncedAt: new Date().toISOString(),
      lastSyncSource: "wix",
      correlationId: `${env.APP_INTERNAL_ID}-${Date.now()}`,
    });
    return;
  }

  let wixId = wixContactId;
  let hubspotId = mapping?.hubspotContactId ?? hubspotContactId ?? "";

  if (wixId) {
    const contactExistsOnCurrentSite = await hasWixContact(event.wixSiteId, wixId);
    if (!contactExistsOnCurrentSite) {
      logger.warn(
        { wixId, hubspotContactId, wixSiteId: event.wixSiteId },
        "HubSpot→Wix: mapped Wix contact not found on current site; clearing stale mapping and falling back to create or link-by-email",
      );
      await deleteSyncMappingByWixContactId(wixId);
      wixId = "";
    }
  }

  if (!wixId && hubspotContactId) {
    let created: string | null = null;
    let createFailureMessage = "";
    try {
      created = await createWixContactFromHubspotPayload(event.wixSiteId, hubspotContactId, outbound);
    } catch (error) {
      createFailureMessage = error instanceof Error ? error.message : "Unknown Wix create error";
    }
    if (!created) {
      const emailKey = outboundEmailForLookup(outbound);
      if (emailKey) {
        const existingId = await findWixContactIdByPrimaryEmail(event.wixSiteId, emailKey);
        if (existingId) {
          created = await applyInboundHubspotToWixContact(event.wixSiteId, existingId, outbound);
        }
      }
    }
    if (!created) {
      throw new Error(
        createFailureMessage
          ? `HubSpot→Wix create failed: ${createFailureMessage}`
          : "HubSpot→Wix create failed: unable to create Wix contact (check WIX_API_KEY/site permissions and mapped email/name/phone fields)",
      );
    }
    wixId = created;
  } else if (wixId) {
    wixId = await applyInboundHubspotToWixContact(event.wixSiteId, wixId, outbound);
  } else {
    throw new Error("HubSpot→Wix event missing both wixContactId and hubspotContactId");
  }

  if (hubspotContactId) {
    hubspotId = hubspotContactId;
  }
  if (!hubspotId) {
    logger.warn({ wixId }, "HubSpot→Wix: missing hubspot_contact_id; not updating sync_mapping");
    return;
  }

  await upsertSyncMapping({
    wixContactId: wixId,
    hubspotContactId: hubspotId,
    lastSyncedAt: new Date().toISOString(),
    lastSyncSource: "hubspot",
    correlationId: `${env.APP_INTERNAL_ID}-${Date.now()}`,
  });
}
