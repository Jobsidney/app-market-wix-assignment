const META_SITE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESERVED = new Set(["demo-site", "localhost", "test", "default"]);

export function isValidWixMetaSiteId(wixSiteId: string | undefined | null): boolean {
  if (!wixSiteId) {
    return false;
  }
  const t = wixSiteId.trim();
  if (t.length < 32) {
    return false;
  }
  if (RESERVED.has(t.toLowerCase())) {
    return false;
  }
  return META_SITE_UUID.test(t);
}

export function assertValidWixMetaSiteId(wixSiteId: string, context: string): void {
  if (isValidWixMetaSiteId(wixSiteId)) {
    return;
  }
  throw new Error(`${context}: invalid wix_site_id (expected Wix meta-site UUID)`);
}
