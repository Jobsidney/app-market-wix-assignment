import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
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

async function resolveMetaSiteId(wixSiteId: string): Promise<string> {
  const result = await db.query<{ wix_meta_site_id: string | null }>(
    `select coalesce(o.wix_meta_site_id, s.wix_meta_site_id) as wix_meta_site_id
     from (select $1::text as id) ref
     left join oauth_installations o on o.wix_site_id = ref.id
     left join site_meta s on s.wix_site_id = ref.id
     limit 1`,
    [wixSiteId],
  );
  return result.rows[0]?.wix_meta_site_id ?? wixSiteId;
}

async function wixHeaders(wixSiteId: string): Promise<Record<string, string> | null> {
  if (!env.WIX_API_KEY) {
    return null;
  }
  const siteId = await resolveMetaSiteId(wixSiteId);
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

interface WixContactJson {
  revision?: number;
  contact?: {
    revision?: number;
    info?: {
      name?: { first?: string; last?: string };
      emails?: { items?: Array<{ email?: string; primary?: boolean }> };
      phones?: { items?: Array<{ phone?: string; primary?: boolean }> };
      jobTitle?: string;
      company?: string;
    };
    primaryInfo?: { email?: string; phone?: string };
  };
}

async function fetchWixContact(wixSiteId: string, contactId: string): Promise<WixContactJson | null> {
  const headers = await wixHeaders(wixSiteId);
  if (!headers) {
    return null;
  }
  const res = await fetch(`${CONTACTS_V4}/${encodeURIComponent(contactId)}`, { method: "GET", headers });
  if (!res.ok) {
    logger.warn({ contactId, status: res.status }, "Wix GET contact failed");
    return null;
  }
  return (await res.json()) as WixContactJson;
}

async function fetchContactRevision(wixSiteId: string, contactId: string): Promise<number | null> {
  const json = await fetchWixContact(wixSiteId, contactId);
  if (!json) {
    return null;
  }
  const rev = json.revision ?? json.contact?.revision;
  return typeof rev === "number" ? rev : null;
}

export async function hasWixContact(wixSiteId: string, contactId: string): Promise<boolean> {
  const revision = await fetchContactRevision(wixSiteId, contactId);
  return revision !== null;
}

export async function getWixContactProperties(
  wixSiteId: string,
  contactId: string,
): Promise<Record<string, unknown> | null> {
  const json = await fetchWixContact(wixSiteId, contactId);
  if (!json) {
    return null;
  }
  const contact = json.contact;
  if (!contact) {
    return null;
  }
  const info = contact.info ?? {};
  const primaryEmail =
    contact.primaryInfo?.email ??
    info.emails?.items?.find((e) => e.primary)?.email ??
    info.emails?.items?.[0]?.email;
  const primaryPhone =
    contact.primaryInfo?.phone ??
    info.phones?.items?.find((p) => p.primary)?.phone ??
    info.phones?.items?.[0]?.phone;
  const result: Record<string, unknown> = {};
  if (info.name?.first) result["contactInfo.firstName"] = info.name.first;
  if (info.name?.last) result["contactInfo.lastName"] = info.name.last;
  if (primaryEmail) result["primaryInfo.email"] = primaryEmail;
  if (primaryPhone) result["primaryInfo.phone"] = primaryPhone;
  if (info.jobTitle) result["extendedFields.jobTitle"] = info.jobTitle;
  if (info.company) result["extendedFields.company"] = info.company;
  return result;
}

export async function createWixContactFromHubspotPayload(
  wixSiteId: string,
  hubspotContactId: string,
  transformedPayload: Record<string, unknown>,
): Promise<string> {
  const shadowKey = `hubspot-${hubspotContactId}`;
  await upsertWixContactShadow(wixSiteId, shadowKey, transformedPayload);
  const headers = await wixHeaders(wixSiteId);
  if (!headers) {
    throw new Error("WIX_API_KEY is not configured — set it in your server environment variables");
  }
  const info = buildWixContactInfoPatch(transformedPayload);
  if (Object.keys(info).length === 0) {
    throw new Error(
      "HubSpot contact has no mappable fields (name, email, or phone). " +
        "Make sure the contact has at least one of these set in HubSpot, " +
        "and that your field mappings include email, firstname, or lastname.",
    );
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
    throw new Error(`Wix API rejected contact creation (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { contact?: { id?: string } };
  const id = json.contact?.id;
  if (!id) {
    throw new Error("Wix API created the contact but returned no contact ID in the response");
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
  const headers = await wixHeaders(wixSiteId);
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
