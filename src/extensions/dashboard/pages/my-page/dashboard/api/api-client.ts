const configuredApiBase = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim();
const appMarketApiKey = (import.meta.env.PUBLIC_APP_MARKET_API_KEY as string | undefined)?.trim();
const defaultWixSiteId = (import.meta.env.PUBLIC_DEFAULT_WIX_SITE_ID as string | undefined)?.trim() || "demo-site";

function getWixSignedInstanceFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("instance");
}
const apiBase =
  configuredApiBase && configuredApiBase.length > 0
    ? configuredApiBase
    : typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8787"
      : "http://127.0.0.1:8787";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const instance = getWixSignedInstanceFromUrl();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache",
      pragma: "no-cache",
      ...(instance
        ? { authorization: instance }
        : { "x-wix-site-id": defaultWixSiteId }),
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
