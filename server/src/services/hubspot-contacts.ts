import { Client } from "@hubspot/api-client";
import { getValidAccessToken } from "./hubspot-auth.js";
import { getHubspotProperties } from "./hubspot-properties-cache.js";

type HubspotProps = Record<string, string>;

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
  const normalized = await filterKnownProperties(wixSiteId, client, toStringRecord(mappedProperties));
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
