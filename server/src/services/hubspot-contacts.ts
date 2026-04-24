import { Client } from "@hubspot/api-client";
import { logger } from "../lib/logger.js";
import { getValidAccessToken } from "./hubspot-auth.js";
import { getHubspotProperties } from "./hubspot-properties-cache.js";

type HubspotProps = Record<string, string>;

function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const direct = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (direct.test(trimmed)) {
    return trimmed;
  }
  const tokenized = trimmed
    .split(/[,\s;|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  for (const token of tokenized) {
    if (direct.test(token)) {
      return token;
    }
  }
  const embedded = trimmed.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return embedded ? embedded[0].toLowerCase() : null;
}
//changes
function toStringRecord(input: Record<string, unknown>): HubspotProps {
  const out: HubspotProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) {
      continue;
    }
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

async function filterKnownProperties(wixSiteId: string, client: Client, props: HubspotProps): Promise<HubspotProps> {
  const accessToken = client.config.accessToken ?? "";
  const metadata = (await getHubspotProperties(wixSiteId, accessToken)) as Array<{ name?: string }>;
  const allowed = new Set(metadata.map((item) => item.name).filter((v): v is string => Boolean(v)));
  const filtered: HubspotProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function normalizeHubspotProperties(props: HubspotProps): HubspotProps {
  const next: HubspotProps = { ...props };
  if (typeof next.email === "string") {
    const normalized = normalizeEmail(next.email);
    if (normalized) {
      next.email = normalized;
    } else {
      delete next.email;
    }
  }
  return next;
}

async function findByEmail(client: Client, email?: string): Promise<string | null> {
  if (!email) {
    return null;
  }
  const search = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ" as never, value: email }] }],
    limit: 1,
    properties: ["email"],
  });
  return search.results[0]?.id ?? null;
}

export async function upsertHubspotContact(
  wixSiteId: string,
  mappedProperties: Record<string, unknown>,
  existingHubspotContactId?: string,
): Promise<string> {
  const accessToken = await getValidAccessToken(wixSiteId);
  const client = new Client({ accessToken });
  const normalized = normalizeHubspotProperties(
    await filterKnownProperties(wixSiteId, client, toStringRecord(mappedProperties)),
  );
  if (Object.keys(normalized).length === 0) {
    throw new Error("No valid HubSpot properties after mapping");
  }

  const hubspotId = existingHubspotContactId || (await findByEmail(client, normalized.email));
  if (hubspotId) {
    await client.crm.contacts.basicApi.update(hubspotId, { properties: normalized });
    return hubspotId;
  }
  const created = await client.crm.contacts.basicApi.create({ properties: normalized });
  return created.id;
}

export async function getHubspotContactProperties(
  wixSiteId: string,
  hubspotContactId: string,
  properties: string[],
): Promise<Record<string, unknown> | null> {
  const accessToken = await getValidAccessToken(wixSiteId);
  const client = new Client({ accessToken });
  const requested = Array.from(
    new Set(
      properties
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  try {
    const contact = await client.crm.contacts.basicApi.getById(
      hubspotContactId,
      requested.length > 0 ? requested : undefined,
      undefined,
      undefined,
      false,
    );
    return { ...(contact.properties ?? {}), hubspotContactId: contact.id };
  } catch (error) {
    logger.warn({ hubspotContactId, error }, "HubSpot GET contact failed for webhook enrichment");
    return null;
  }
}
