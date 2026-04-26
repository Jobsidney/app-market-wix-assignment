import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { getMetaSiteIdFromPayload, verifyWixSignedInstance } from "../lib/wix-app-instance.js";

export const lifecycleRouter = Router();

const SITE_TABLES = [
  "oauth_installations",
  "field_mappings",
  "sync_jobs",
  "sync_definitions",
  "sync_mapping",
  "form_submission_events",
  "site_sync_state",
  "hubspot_embed_settings",
  "wix_contacts_shadow",
] as const;

async function deleteSiteData(wixSiteId: string): Promise<void> {
  for (const table of SITE_TABLES) {
    await db.query(`delete from ${table} where wix_site_id = $1`, [wixSiteId]);
  }
}

lifecycleRouter.post("/wix", async (req, res) => {
  const instance = req.body?.instance as string | undefined;
  if (!instance || !env.WIX_APP_SECRET) {
    res.status(400).json({ error: "Missing instance or app secret not configured" });
    return;
  }

  const payload = verifyWixSignedInstance(instance, env.WIX_APP_SECRET);
  if (!payload) {
    res.status(401).json({ error: "Invalid Wix instance signature" });
    return;
  }

  const eventType = req.body?.eventType as string | undefined;
  const wixSiteId = (payload.instanceId ?? payload.siteId) as string | undefined;
  const metaSiteId = getMetaSiteIdFromPayload(payload);

  logger.info({ eventType, wixSiteId, metaSiteId }, "Wix lifecycle event received");

  if (eventType === "APP_INSTALLED" && wixSiteId) {
    await db.query(
      `insert into site_meta (wix_site_id, wix_meta_site_id)
       values ($1, $2)
       on conflict (wix_site_id)
       do update set wix_meta_site_id = coalesce($2, site_meta.wix_meta_site_id),
                     updated_at = now()`,
      [wixSiteId, metaSiteId ?? null],
    );
    await db.query(
      `update oauth_installations
       set wix_meta_site_id = $2
       where wix_site_id = $1 and $2 is not null`,
      [wixSiteId, metaSiteId ?? null],
    );
    logger.info({ wixSiteId, metaSiteId }, "APP_INSTALLED: site meta stored");
  }

  if (eventType === "APP_REMOVED" && wixSiteId) {
    await deleteSiteData(wixSiteId);
    await db.query("delete from site_meta where wix_site_id = $1", [wixSiteId]);
    logger.info({ wixSiteId }, "APP_REMOVED: site data deleted");
  }

  res.status(200).json({ ok: true });
});
