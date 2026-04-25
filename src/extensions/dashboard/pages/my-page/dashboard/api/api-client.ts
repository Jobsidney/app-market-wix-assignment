const configuredApiBase = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim();
const appMarketApiKey = (import.meta.env.PUBLIC_APP_MARKET_API_KEY as string | undefined)?.trim();
const defaultWixSiteId = (import.meta.env.PUBLIC_DEFAULT_WIX_SITE_ID as string | undefined)?.trim() || "";
const INSTANCE_STORAGE_KEY = "wix-hubspot-sync.instance";

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

const META_SITE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidShape(value: string): boolean {
  return META_SITE_UUID.test(value.trim());
}

function pickMetaSiteFromPayload(payload: Record<string, unknown>): string | null {
  const site = payload.site;
  const candidates: Array<unknown> = [
    payload.metaSiteId,
    payload.metasiteId,
    payload.siteId,
    site && typeof site === "object" ? (site as Record<string, unknown>).metaSiteId : undefined,
    site && typeof site === "object" ? (site as Record<string, unknown>).metasiteId : undefined,
    payload.instanceId,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() && isUuidShape(value)) {
      return value.trim();
    }
  }
  return null;
}

function parseDecodedJsonParam(raw: string | null): Record<string, unknown> | null {
  if (!raw || !raw.trim()) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw.trim());
    const parsed = JSON.parse(decoded) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function deepFindMetaSiteId(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && isUuidShape(value)) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = deepFindMetaSiteId(item, depth + 1);
      if (hit) {
        return hit;
      }
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredKeys = ["metaSiteId", "metasiteId", "siteId", "wixSiteId", "msid"];
    for (const key of preferredKeys) {
      const v = obj[key];
      if (typeof v === "string" && isUuidShape(v)) {
        return v.trim();
      }
    }
    for (const v of Object.values(obj)) {
      const hit = deepFindMetaSiteId(v, depth + 1);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

function getWixSiteIdFromDashboardQuery(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const buckets = [
    parseDecodedJsonParam(params.get("siteInfo")),
    parseDecodedJsonParam(params.get("essentials")),
  ];
  for (const bucket of buckets) {
    if (!bucket) {
      continue;
    }
    const site = pickMetaSiteFromPayload(bucket);
    if (site) {
      return site;
    }
    const deep = deepFindMetaSiteId(bucket);
    if (deep) {
      return deep;
    }
  }
  return null;
}

function getWixSiteIdFromInstance(instance: string | null): string | null {
  if (!instance || !instance.includes(".")) {
    return null;
  }
  const payloadPart = instance.split(".")[1];
  if (!payloadPart) {
    return null;
  }
  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return pickMetaSiteFromPayload(parsed);
  } catch {
    return null;
  }
}

function getWixSignedInstanceFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromUrl = new URLSearchParams(window.location.search).get("instance");
  if (fromUrl && fromUrl.trim()) {
    window.sessionStorage.setItem(INSTANCE_STORAGE_KEY, fromUrl.trim());
    return fromUrl.trim();
  }
  const fromStorage = window.sessionStorage.getItem(INSTANCE_STORAGE_KEY);
  return fromStorage && fromStorage.trim() ? fromStorage.trim() : null;
}

function getWixSiteIdFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/\/dashboard\/([^/]+)/);
  return match?.[1] ?? null;
}

function getScopedInstanceForCurrentSite(pathSiteId: string | null): string | null {
  const instance = getWixSignedInstanceFromUrl();
  if (!instance) {
    return null;
  }
  if (!pathSiteId) {
    return instance;
  }
  const instanceSiteId = getWixSiteIdFromInstance(instance);
  if (!instanceSiteId) {
    return instance;
  }
  if (instanceSiteId === pathSiteId) {
    return instance;
  }
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(INSTANCE_STORAGE_KEY);
  }
  return null;
}
const apiBase =
  configuredApiBase && configuredApiBase.length > 0
    ? configuredApiBase
    : typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8787"
      : "https://app-market-wix-assignment-production.up.railway.app";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const pathSiteId = getWixSiteIdFromUrl();
  const instance = getScopedInstanceForCurrentSite(pathSiteId);
  const querySiteId = getWixSiteIdFromDashboardQuery();
  const wixSiteId =
    (pathSiteId && isUuidShape(pathSiteId) ? pathSiteId : null) ||
    querySiteId ||
    getWixSiteIdFromInstance(instance) ||
    (defaultWixSiteId && isUuidShape(defaultWixSiteId) ? defaultWixSiteId : "");
  if (!wixSiteId) {
    throw new Error("Missing Wix site context for dashboard request");
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache",
      pragma: "no-cache",
      ...(instance ? { authorization: instance } : {}),
      "x-wix-site-id": wixSiteId,
      ...(appMarketApiKey ? { "x-app-market-key": appMarketApiKey } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
