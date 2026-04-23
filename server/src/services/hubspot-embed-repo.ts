import { db } from "../lib/db.js";

export interface HubspotEmbedSettings {
  portalId: string;
  formId: string;
  region: string;
}

export async function getHubspotEmbedSettings(wixSiteId: string): Promise<HubspotEmbedSettings | null> {
  const result = await db.query<{ portal_id: string; form_id: string; region: string }>(
    "select portal_id, form_id, region from hubspot_embed_settings where wix_site_id = $1",
    [wixSiteId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { portalId: row.portal_id, formId: row.form_id, region: row.region };
}

export async function upsertHubspotEmbedSettings(wixSiteId: string, settings: HubspotEmbedSettings): Promise<void> {
  await db.query(
    `insert into hubspot_embed_settings (wix_site_id, portal_id, form_id, region, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (wix_site_id)
     do update set portal_id = excluded.portal_id,
                   form_id = excluded.form_id,
                   region = excluded.region,
                   updated_at = now()`,
    [wixSiteId, settings.portalId, settings.formId, settings.region],
  );
}
