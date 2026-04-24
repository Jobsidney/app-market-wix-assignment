import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { deepEqual } from "./idempotency.js";
import { listFieldMappings } from "./field-mapping-repo.js";
import { getSyncMappingByHubspotId, getSyncMappingByWixId, upsertSyncMapping } from "./sync-mapping-repo.js";
import { transformByPersistedMappings } from "./mapping-transformer.js";
import { upsertHubspotContact } from "./hubspot-contacts.js";
import {
  applyInboundHubspotToWixContact,
  createWixContactFromHubspotPayload,
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

function extractWixContactId(payload: Record<string, unknown>, fallbackId?: string): string {
  const bodyData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
  const nestedEvent = parseObjectLikeJson(bodyData?.data) ?? parseObjectLikeJson(payload.data);
  return (
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
    ) ?? ""
  );
}

function summarizePayloadShape(payload: Record<string, unknown>): string {
  try {
    const topKeys = Object.keys(payload).slice(0, 20);
    const dataKeys =
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? Object.keys(payload.data as Record<string, unknown>).slice(0, 20)
        : [];
    const nestedDataKeys =
      payload.data && typeof (payload.data as Record<string, unknown>).data === "string"
        ? "stringified"
        : payload.data && typeof (payload.data as Record<string, unknown>).data === "object"
          ? Object.keys((payload.data as Record<string, unknown>).data as Record<string, unknown>).slice(0, 20).join(",")
          : "";
    const preview = JSON.stringify(payload).slice(0, 600);
    return `keys=[${topKeys.join(",")}] data=[${dataKeys.join(",")}] data.data=[${nestedDataKeys}] preview=${preview}`;
  } catch {
    return "payload_unserializable";
  }
}

export async function processSyncEvent(event: IncomingEvent): Promise<void> {
  const resolvedWixContactId = extractWixContactId(event.payload, event.wixContactId);
  if (event.source === "wix" && !resolvedWixContactId) {
    const shape = summarizePayloadShape(event.payload);
    logger.error({ shape, syncId: event.syncId }, "Missing wixContactId in sync event");
    throw new Error(`Missing wixContactId in sync event (${shape})`);
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

  const eventUpdatedAt = event.updatedAt ? new Date(event.updatedAt).getTime() : Date.now();
  const lastSyncedAt = mapping ? new Date(mapping.lastSyncedAt).getTime() : 0;
  if (lastSyncedAt && eventUpdatedAt <= lastSyncedAt) {
    logger.info({ wixContactId: wixContactId || hubspotContactId }, "Conflict handling: skipped older event");
    return;
  }

  const fieldRows = await listFieldMappings(event.wixSiteId, event.syncId);
  const transformed =
    event.source === "wix"
      ? transformByPersistedMappings(event.payload, fieldRows, "wix_to_hubspot")
      : transformByPersistedMappings(event.payload, fieldRows, "hubspot_to_wix");

  let outbound = transformed;
  if (Object.keys(outbound).length === 0 && event.source === "wix") {
    outbound = buildWixFallbackHubspotPayload(event.payload);
  }
  if (Object.keys(outbound).length === 0) {
    logger.info(
      { wixSiteId: event.wixSiteId, wixContactId, hubspotContactId, source: event.source },
      "No mapped fields after persisted mappings; skipping",
    );
    return;
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

  if (!wixId && hubspotContactId) {
    const created = await createWixContactFromHubspotPayload(event.wixSiteId, hubspotContactId, outbound);
    if (!created) {
      logger.warn({ hubspotContactId }, "HubSpot→Wix: could not create Wix contact (check WIX_API_KEY and mapped name/email/phone)");
      return;
    }
    wixId = created;
  } else if (wixId) {
    wixId = await applyInboundHubspotToWixContact(event.wixSiteId, wixId, outbound);
  } else {
    logger.warn({ payloadKeys: Object.keys(event.payload) }, "HubSpot→Wix: missing wixContactId and hubspotContactId");
    return;
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
