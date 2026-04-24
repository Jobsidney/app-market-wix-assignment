const configuredApiBase = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim();
const appMarketApiKey = (import.meta.env.PUBLIC_APP_MARKET_API_KEY as string | undefined)?.trim();
const defaultWixSiteId = (import.meta.env.PUBLIC_DEFAULT_WIX_SITE_ID as string | undefined)?.trim() || "demo-site";
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
    const parsed = JSON.parse(decoded) as { instanceId?: string };
    return typeof parsed.instanceId === "string" && parsed.instanceId.trim() ? parsed.instanceId.trim() : null;
  } catch {
    return null;
  }
}

function getWixSignedInstanceFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const siteIdFromPath = getWixSiteIdFromUrl();
  const fromUrl = new URLSearchParams(window.location.search).get("instance");
  if (fromUrl && fromUrl.trim()) {
    const normalized = fromUrl.trim();
    const siteIdFromUrlInstance = getWixSiteIdFromInstance(normalized);
    if (siteIdFromPath && siteIdFromUrlInstance && siteIdFromPath !== siteIdFromUrlInstance) {
      window.sessionStorage.removeItem(INSTANCE_STORAGE_KEY);
      return null;
    }
    window.sessionStorage.setItem(INSTANCE_STORAGE_KEY, normalized);
    return normalized;
  }
  const fromStorage = window.sessionStorage.getItem(INSTANCE_STORAGE_KEY);
  if (!fromStorage || !fromStorage.trim()) {
    return null;
  }
  const normalized = fromStorage.trim();
  const siteIdFromStoredInstance = getWixSiteIdFromInstance(normalized);
  if (siteIdFromPath && siteIdFromStoredInstance && siteIdFromPath !== siteIdFromStoredInstance) {
    window.sessionStorage.removeItem(INSTANCE_STORAGE_KEY);
    return null;
  }
  return normalized;
}

function getWixSiteIdFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/\/dashboard\/([^/]+)/);
  return match?.[1] ?? null;
}
const apiBase =
  configuredApiBase && configuredApiBase.length > 0
    ? configuredApiBase
    : typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8787"
      : "https://app-market-wix-assignment-production.up.railway.app";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const instance = getWixSignedInstanceFromUrl();
  const wixSiteId = getWixSiteIdFromInstance(instance) || getWixSiteIdFromUrl() || defaultWixSiteId;
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
