import { Client } from "@hubspot/api-client";

const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; data: unknown[] }>();

export async function getHubspotProperties(wixSiteId: string, accessToken: string): Promise<unknown[]> {
  const cached = cache.get(wixSiteId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const client = new Client({ accessToken });
  const response = await client.crm.properties.coreApi.getAll("contacts");
  const data = response.results;
  cache.set(wixSiteId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
  return data;
}
