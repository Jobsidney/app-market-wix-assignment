import type { Request, Response } from "express";
import { Router } from "express";
import { enqueueJob } from "../services/sync-job-queue.js";
import { getSiteSyncLiveEnabled } from "../services/site-sync-state-repo.js";
import { verifyWebhookHmac } from "../middleware/verify-webhook-hmac.js";
import { verifyHubspotSignature } from "../middleware/verify-hubspot-signature.js";
import { resolveWixSiteIdByHubspotPortalId } from "../services/hubspot-auth.js";
import { getDefaultSyncId, listSyncDefinitions } from "../services/sync-definitions-repo.js";
import { db } from "../lib/db.js";

export const webhooksRouter = Router();

type SyncSource = "wix" | "hubspot";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholderToken(value: string): boolean {
  const v = value.trim();
  if (!v) {
    return true;
  }
  if (v.startsWith("{{") && v.endsWith("}}")) {
    return true;
  }
  const known = new Set([
    "contact.id",
    "wixcontactid",
    "primaryinfo.email",
    "contact.primaryinfo.email",
    "contact.email",
    "contact.firstname",
    "contact.lastname",
    "contact.phone",
  ]);
  return known.has(v.toLowerCase());
}

function readMeaningfulString(value: unknown): string {
  const candidate = readString(value);
  if (!candidate || isPlaceholderToken(candidate)) {
    return "";
  }
  return candidate;
}

function looksLikePathToken(value: string): boolean {
  return /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(value);
}

function resolveFromTokenPath(body: Record<string, unknown>, tokenValue: unknown): string {
  const token = readString(tokenValue);
  if (!token || !looksLikePathToken(token)) {
    return "";
  }
  const fromRoot = readNestedString(body, token);
  if (fromRoot) {
    return fromRoot;
  }
  const nestedData = body.data;
  if (nestedData && typeof nestedData === "object") {
    const fromData = readNestedString(nestedData as Record<string, unknown>, token);
    if (fromData) {
      return fromData;
    }
  }
  const nestedPayload = body.payload;
  if (nestedPayload && typeof nestedPayload === "object") {
    const fromPayload = readNestedString(nestedPayload as Record<string, unknown>, token);
    if (fromPayload) {
      return fromPayload;
    }
  }
  return "";
}

function readNestedString(source: Record<string, unknown>, path: string): string {
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return readMeaningfulString(current);
}

function findFirstStringByKeys(source: unknown, keys: Set<string>): string {
  if (!source || typeof source !== "object") {
    return "";
  }
  const queue: unknown[] = [source];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [rawKey, value] of Object.entries(current as Record<string, unknown>)) {
      const key = rawKey.replace(/[\s_-]/g, "").toLowerCase();
      if (keys.has(key)) {
        const candidate = readMeaningfulString(value);
        if (candidate) {
          return candidate;
        }
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return "";
}

function findPrimaryEmail(source: unknown): string {
  if (!source || typeof source !== "object") {
    return "";
  }
  const queue: unknown[] = [source];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [rawKey, value] of Object.entries(current as Record<string, unknown>)) {
      const key = rawKey.replace(/[\s_-]/g, "").toLowerCase();
      if (key === "emails" && Array.isArray(value)) {
        for (const item of value) {
          if (!item || typeof item !== "object") {
            continue;
          }
          const rec = item as Record<string, unknown>;
          const email = readMeaningfulString(rec.email);
          const primary = rec.primary === true || readMeaningfulString(rec.primary).toLowerCase() === "true";
          if (email && primary) {
            return email;
          }
        }
        for (const item of value) {
          if (!item || typeof item !== "object") {
            continue;
          }
          const email = readMeaningfulString((item as Record<string, unknown>).email);
          if (email) {
            return email;
          }
        }
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return "";
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

async function enqueueIncomingEvent(
  req: Request,
  res: Response,
  source: SyncSource,
  wixSiteId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const syncIdQuery = typeof req.query.syncId === "string" ? Number(req.query.syncId) : NaN;
  const syncIdBody = typeof body.syncId === "number" ? body.syncId : Number(body.syncId ?? NaN);
  const explicitSyncId = Number.isFinite(syncIdBody)
    ? syncIdBody
    : Number.isFinite(syncIdQuery)
      ? syncIdQuery
      : undefined;
  const resolvedWixSiteId = await resolveWixSiteIdForSync(wixSiteId, explicitSyncId);
  if (!(await getSiteSyncLiveEnabled(resolvedWixSiteId))) {
    res.status(200).json({ accepted: true, skipped: "sync_paused" });
    return;
  }
  const targetSyncIds = await resolveTargetSyncIds(resolvedWixSiteId, explicitSyncId, source);
  res.status(200).json({ accepted: true, syncTargets: targetSyncIds.length });
  await Promise.all(
    targetSyncIds.map((syncId) =>
      enqueueJob(
        resolvedWixSiteId,
        "sync_event",
        { ...body, source, syncId },
        syncId,
      ),
    ),
  );
}

async function resolveTargetSyncIds(
  wixSiteId: string,
  explicitSyncId: number | undefined,
  source: SyncSource,
): Promise<number[]> {
  const isDirectionCompatible = (direction: string): boolean => {
    if (source === "wix") {
      return direction === "wix_to_hubspot" || direction === "bidirectional";
    }
    return direction === "hubspot_to_wix" || direction === "bidirectional";
  };
  if (Number.isFinite(explicitSyncId)) {
    const scoped = await db.query<{ id: number; sync_direction: string }>(
      "select id, sync_direction from sync_definitions where id = $1 and wix_site_id = $2 limit 1",
      [explicitSyncId, wixSiteId],
    );
    if (scoped.rows[0] && isDirectionCompatible(scoped.rows[0].sync_direction)) {
      return [explicitSyncId as number];
    }
  }
  const syncs = await listSyncDefinitions(wixSiteId);
  const liveSyncIds = syncs
    .filter((sync) => sync.live && isDirectionCompatible(sync.syncDirection))
    .map((sync) => Number(sync.id))
    .filter((id) => Number.isFinite(id));
  if (liveSyncIds.length > 0) {
    return liveSyncIds;
  }
  return [await getDefaultSyncId(wixSiteId)];
}

async function resolveWixSiteIdForSync(
  wixSiteId: string,
  explicitSyncId: number | undefined,
): Promise<string> {
  if (!Number.isFinite(explicitSyncId)) {
    return wixSiteId;
  }
  const result = await db.query<{ wix_site_id: string }>("select wix_site_id from sync_definitions where id = $1", [
    explicitSyncId,
  ]);
  const resolved = result.rows[0]?.wix_site_id;
  if (!resolved || resolved !== wixSiteId) {
    return wixSiteId;
  }
  return resolved;
}

async function handleWixContactWebhook(req: Request, res: Response): Promise<void> {
  const body = (req.body as Record<string, unknown>) ?? {};
  const bodyData = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  const nestedEvent = parseObjectLikeJson(bodyData?.data);
  const createdEntity =
    nestedEvent?.createdEvent &&
    typeof nestedEvent.createdEvent === "object" &&
    (nestedEvent.createdEvent as Record<string, unknown>).entity &&
    typeof (nestedEvent.createdEvent as Record<string, unknown>).entity === "object"
      ? ((nestedEvent.createdEvent as Record<string, unknown>).entity as Record<string, unknown>)
      : null;
  const updatedEntity =
    nestedEvent?.updatedEvent &&
    typeof nestedEvent.updatedEvent === "object" &&
    (nestedEvent.updatedEvent as Record<string, unknown>).entity &&
    typeof (nestedEvent.updatedEvent as Record<string, unknown>).entity === "object"
      ? ((nestedEvent.updatedEvent as Record<string, unknown>).entity as Record<string, unknown>)
      : null;
  const enrichedBody: Record<string, unknown> = {
    ...body,
    ...(nestedEvent ?? {}),
    ...(createdEntity ? { contact: createdEntity } : {}),
    ...(updatedEntity ? { contact: updatedEntity } : {}),
  };
  const wixSiteIdHeader = req.header("x-wix-site-id")?.trim() ?? "";
  const wixSiteIdQuery = typeof req.query.wixSiteId === "string" ? req.query.wixSiteId.trim() : "";
  const wixSiteIdBody =
    (typeof body.wixSiteId === "string" ? body.wixSiteId.trim() : "") ||
    (typeof enrichedBody.instanceId === "string" ? enrichedBody.instanceId.trim() : "") ||
    (typeof bodyData?.instanceId === "string" ? bodyData.instanceId.trim() : "");
  const wixSiteId = wixSiteIdHeader || wixSiteIdQuery || wixSiteIdBody;
  if (!wixSiteId) {
    res
      .status(400)
      .json({ error: "Missing Wix site id (x-wix-site-id header, wixSiteId query, or wixSiteId body field)" });
    return;
  }
  const normalizedPayload: Record<string, unknown> = { ...body };
  const syncIdQuery = typeof req.query.syncId === "string" ? Number(req.query.syncId) : NaN;
  const syncIdBody = Number(normalizedPayload.syncId);
  const explicitSyncId = Number.isFinite(syncIdBody)
    ? syncIdBody
    : Number.isFinite(syncIdQuery)
      ? syncIdQuery
      : undefined;
  const wixContactId =
    readMeaningfulString(enrichedBody.wixContactId) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.wixContactId) ||
    readMeaningfulString(enrichedBody.contactId) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.contactId) ||
    readMeaningfulString(enrichedBody.entityId) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.entityId) ||
    readNestedString(enrichedBody, "data.wixContactId") ||
    readNestedString(enrichedBody, "data.entityId") ||
    readNestedString(enrichedBody, "payload.wixContactId") ||
    readNestedString(enrichedBody, "payload.entityId") ||
    readNestedString(enrichedBody, "contact.id") ||
    readNestedString(enrichedBody, "contact.contactId") ||
    readNestedString(enrichedBody, "contactDetails.contactId") ||
    readNestedString(enrichedBody, "createdEvent.entity.id") ||
    readNestedString(enrichedBody, "updatedEvent.entity.id") ||
    findFirstStringByKeys(enrichedBody, new Set(["contactid", "wixcontactid", "entityid"]));
  if (wixContactId) {
    normalizedPayload.wixContactId = wixContactId;
  }
  const email =
    readMeaningfulString(enrichedBody.email) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.email) ||
    readNestedString(enrichedBody, "data.email") ||
    readNestedString(enrichedBody, "payload.email") ||
    readNestedString(enrichedBody, "contact.email") ||
    readNestedString(enrichedBody, "contact.primaryInfo.email") ||
    readNestedString(enrichedBody, "contactDetails.email") ||
    readNestedString(enrichedBody, "contact.emails.0.email") ||
    readNestedString(enrichedBody, "createdEvent.entity.primaryInfo.email") ||
    readNestedString(enrichedBody, "updatedEvent.entity.primaryInfo.email") ||
    findPrimaryEmail(enrichedBody);
  if (email) {
    normalizedPayload.email = email;
  }
  const firstName =
    readMeaningfulString(enrichedBody.firstName) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.firstName) ||
    readNestedString(enrichedBody, "data.firstName") ||
    readNestedString(enrichedBody, "payload.firstName") ||
    readNestedString(enrichedBody, "contact.firstName") ||
    readNestedString(enrichedBody, "contact.name.first") ||
    readNestedString(enrichedBody, "contact.contactInfo.firstName") ||
    readNestedString(enrichedBody, "contactDetails.firstName") ||
    readNestedString(enrichedBody, "createdEvent.entity.info.name.first") ||
    readNestedString(enrichedBody, "updatedEvent.entity.info.name.first");
  if (firstName) {
    normalizedPayload.firstName = firstName;
  }
  const lastName =
    readMeaningfulString(enrichedBody.lastName) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.lastName) ||
    readNestedString(enrichedBody, "data.lastName") ||
    readNestedString(enrichedBody, "payload.lastName") ||
    readNestedString(enrichedBody, "contact.lastName") ||
    readNestedString(enrichedBody, "contact.name.last") ||
    readNestedString(enrichedBody, "contact.contactInfo.lastName") ||
    readNestedString(enrichedBody, "contactDetails.lastName") ||
    readNestedString(enrichedBody, "createdEvent.entity.info.name.last") ||
    readNestedString(enrichedBody, "updatedEvent.entity.info.name.last");
  if (lastName) {
    normalizedPayload.lastName = lastName;
  }
  const phone =
    readMeaningfulString(enrichedBody.phone) ||
    resolveFromTokenPath(enrichedBody, enrichedBody.phone) ||
    readNestedString(enrichedBody, "data.phone") ||
    readNestedString(enrichedBody, "payload.phone") ||
    readNestedString(enrichedBody, "contact.phone") ||
    readNestedString(enrichedBody, "contact.primaryInfo.phone") ||
    readNestedString(enrichedBody, "contactDetails.phone") ||
    readNestedString(enrichedBody, "createdEvent.entity.primaryInfo.phone") ||
    readNestedString(enrichedBody, "updatedEvent.entity.primaryInfo.phone");
  if (phone) {
    normalizedPayload.phone = phone;
  }
  const resolvedWixSiteId = await resolveWixSiteIdForSync(wixSiteId, explicitSyncId);
  if (!(await getSiteSyncLiveEnabled(resolvedWixSiteId))) {
    res.status(200).json({ accepted: true, skipped: "sync_paused" });
    return;
  }
  const targetSyncIds = await resolveTargetSyncIds(resolvedWixSiteId, explicitSyncId, "wix");
  res.status(200).json({ accepted: true, syncTargets: targetSyncIds.length });
  await Promise.all(
    targetSyncIds.map((syncId) =>
      enqueueJob(
        resolvedWixSiteId,
        "sync_event",
        { ...normalizedPayload, source: "wix", syncId },
        syncId,
      ),
    ),
  );
}

async function handleHubspotContactWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "HubSpot webhook payload must be a non-empty array" });
    return;
  }
  const first = body[0];
  if (!first || typeof first !== "object") {
    res.status(400).json({ error: "Invalid HubSpot webhook payload item" });
    return;
  }
  const event = first as Record<string, unknown>;
  const portalId = String(event.portalId ?? event.portal_id ?? "").trim();
  if (!portalId) {
    res.status(400).json({ error: "Missing portalId in HubSpot webhook payload" });
    return;
  }
  const wixSiteId = await resolveWixSiteIdByHubspotPortalId(portalId);
  if (!wixSiteId) {
    res.status(404).json({ error: "No Wix installation mapped for incoming HubSpot portal" });
    return;
  }
  await db.query(
    `update oauth_installations
       set hubspot_portal_id = $2,
           updated_at = now()
     where wix_site_id = $1
       and (hubspot_portal_id is distinct from $2)`,
    [wixSiteId, portalId],
  );
  const payload: Record<string, unknown> = {
    source: "hubspot",
    hubspotContactId: event.objectId ?? event.object_id ?? undefined,
    updatedAt: event.occurredAt ?? event.occurred_at ?? undefined,
    hubspotPortalId: portalId,
  };
  const eventSyncId =
    typeof event.syncId === "number"
      ? event.syncId
      : typeof event.sync_id === "number"
        ? event.sync_id
        : Number(event.syncId ?? event.sync_id ?? NaN);
  if (Number.isFinite(eventSyncId)) {
    payload.syncId = Number(eventSyncId);
  }
  const propertyName = typeof event.propertyName === "string" ? event.propertyName : undefined;
  const propertyValue = event.propertyValue;
  if (propertyName && propertyValue !== undefined) {
    payload[propertyName] = propertyValue;
  }
  await enqueueIncomingEvent(req, res, "hubspot", wixSiteId, payload);
}

webhooksRouter.post("/wix/contact-updated", async (req, res, next) => {
  try {
    verifyWebhookHmac(req, res, async (err) => {
      if (err) {
        next(err);
        return;
      }
      try {
        await handleWixContactWebhook(req, res);
      } catch (inner) {
        next(inner);
      }
    });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post("/hubspot/contact-updated", async (req, res, next) => {
  try {
    verifyHubspotSignature(req, res, async (err) => {
      if (err) {
        next(err);
        return;
      }
      try {
        await handleHubspotContactWebhook(req, res);
      } catch (inner) {
        next(inner);
      }
    });
  } catch (error) {
    next(error);
  }
});
