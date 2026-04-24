import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { upsertWixContactShadow } from "./wix-contacts-shadow.js";

const CONTACTS_V4 = "https://www.wixapis.com/contacts/v4/contacts";

function parseObjectLikeJson(value: string): Record<string, unknown> | null {
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

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function deriveAccountIdFromApiKey(apiKey: string): string | undefined {
  const parts = apiKey.split(".");
  if (parts.length !== 3) {
    return undefined;
  }
  const payloadRaw = base64UrlDecode(parts[1] ?? "");
  const payload = parseObjectLikeJson(payloadRaw);
  const dataRaw = typeof payload?.data === "string" ? payload.data : "";
  const data = dataRaw ? parseObjectLikeJson(dataRaw) : null;
  const tenant = data?.tenant;
  if (!tenant || typeof tenant !== "object") {
    return undefined;
  }
  const id = (tenant as Record<string, unknown>).id;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;
}

function wixHeaders(siteId: string): Record<string, string> | null {
  if (!env.WIX_API_KEY) {
    return null;
  }
  const accountId = env.WIX_ACCOUNT_ID?.trim() || deriveAccountIdFromApiKey(env.WIX_API_KEY);
  return {
    Authorization: env.WIX_API_KEY,
    "wix-site-id": siteId,
    ...(accountId ? { "wix-account-id": accountId } : {}),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function readStr(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : undefined;
}

export function buildWixContactInfoPatch(payload: Record<string, unknown>): Record<string, unknown> {
  const first =
    readStr(payload, "contactInfo.firstName") ??
    readStr(payload, "info.name.first") ??
    readStr(payload, "firstname");
  const last =
    readStr(payload, "contactInfo.lastName") ??
    readStr(payload, "info.name.last") ??
    readStr(payload, "lastname");
  const email =
    readStr(payload, "primaryInfo.email") ??
    readStr(payload, "email") ??
    readStr(payload, "info.emails.items.0.email");
  const phone = readStr(payload, "primaryInfo.phone") ?? readStr(payload, "phone");
  const jobTitle = readStr(payload, "extendedFields.jobTitle") ?? readStr(payload, "jobtitle");
  const company = readStr(payload, "extendedFields.company") ?? readStr(payload, "company");
  const info: Record<string, unknown> = {};
  if (first || last) {
    info.name = { first: first ?? "", last: last ?? "" };
  }
  if (email) {
    info.emails = { items: [{ tag: "MAIN", email, primary: true }] };
  }
  if (phone) {
    info.phones = { items: [{ tag: "MAIN", phone, primary: true }] };
  }
  if (jobTitle) {
    info.jobTitle = jobTitle;
  }
  if (company) {
    info.company = company;
  }
  return info;
}

async function fetchContactRevision(wixSiteId: string, contactId: string): Promise<number | null> {
  const headers = wixHeaders(wixSiteId);
  if (!headers) {
    return null;
  }
  const res = await fetch(`${CONTACTS_V4}/${encodeURIComponent(contactId)}`, { method: "GET", headers });
  if (!res.ok) {
    logger.warn({ contactId, status: res.status }, "Wix GET contact failed");
    return null;
  }
  const json = (await res.json()) as { revision?: number; contact?: { revision?: number } };
  const rev = json.revision ?? json.contact?.revision;
  return typeof rev === "number" ? rev : null;
}

export async function hasWixContact(wixSiteId: string, contactId: string): Promise<boolean> {
  const revision = await fetchContactRevision(wixSiteId, contactId);
  return revision !== null;
}

export async function createWixContactFromHubspotPayload(
  wixSiteId: string,
  hubspotContactId: string,
  transformedPayload: Record<string, unknown>,
): Promise<string | null> {
  const shadowKey = `hubspot-${hubspotContactId}`;
  await upsertWixContactShadow(wixSiteId, shadowKey, transformedPayload);
  const headers = wixHeaders(wixSiteId);
  if (!headers) {
    logger.info({ hubspotContactId }, "WIX_API_KEY unset; HubSpot→Wix create skipped after shadow write");
    return null;
  }
  const info = buildWixContactInfoPatch(transformedPayload);
  if (Object.keys(info).length === 0) {
    logger.warn({ hubspotContactId }, "Cannot create Wix contact: mapped payload has no name, email, or phone");
    return null;
  }
  const res = await fetch(CONTACTS_V4, {
    method: "POST",
    headers,
    body: JSON.stringify({ info, allowDuplicates: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    const responseHeaders = Object.fromEntries(res.headers.entries());
    const safeHeaders = {
      "x-wix-request-id": responseHeaders["x-wix-request-id"],
      "x-wix-error-code": responseHeaders["x-wix-error-code"],
      "x-wix-service-id": responseHeaders["x-wix-service-id"],
      "content-type": responseHeaders["content-type"],
    };
    logger.warn(
      {
        hubspotContactId,
        status: res.status,
        text,
        wixSiteId,
        hasWixApiKey: Boolean(env.WIX_API_KEY),
        hasWixAccountId: Boolean(env.WIX_ACCOUNT_ID),
        requestHeaders: {
          hasAuthorization: Boolean(headers.Authorization),
          hasWixSiteId: Boolean(headers["wix-site-id"]),
          hasWixAccountId: Boolean(headers["wix-account-id"]),
        },
        responseHeaders: safeHeaders,
      },
      "Wix POST create contact failed",
    );
    return null;
  }
  const json = (await res.json()) as { contact?: { id?: string } };
  const id = json.contact?.id;
  if (!id) {
    logger.warn({ hubspotContactId }, "Wix create contact response missing id");
    return null;
  }
  await upsertWixContactShadow(wixSiteId, id, transformedPayload);
  return id;
}

export async function applyInboundHubspotToWixContact(
  wixSiteId: string,
  wixContactId: string,
  transformedPayload: Record<string, unknown>,
): Promise<string> {
  await upsertWixContactShadow(wixSiteId, wixContactId, transformedPayload);
  const headers = wixHeaders(wixSiteId);
  if (!headers) {
    throw new Error("WIX_API_KEY is missing; cannot apply HubSpot→Wix update");
  }
  const info = buildWixContactInfoPatch(transformedPayload);
  if (Object.keys(info).length === 0) {
    throw new Error("No Wix ContactInfo fields derived for HubSpot→Wix update");
  }
  const revision = await fetchContactRevision(wixSiteId, wixContactId);
  if (revision === null) {
    throw new Error(`Could not read Wix contact revision for ${wixContactId}`);
  }
  const res = await fetch(`${CONTACTS_V4}/${encodeURIComponent(wixContactId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ revision, info, allowDuplicates: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wix PATCH contact failed (${res.status}): ${text}`);
  }
  return wixContactId;
}
