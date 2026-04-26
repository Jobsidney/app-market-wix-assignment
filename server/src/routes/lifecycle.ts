import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { verifyWixSignedInstance } from "../lib/wix-app-instance.js";

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
  const wixSiteId = (payload.siteId ?? payload.instanceId) as string | undefined;

  logger.info({ eventType, wixSiteId }, "Wix lifecycle event received");

  if (eventType === "APP_REMOVED" && wixSiteId) {
    await deleteSiteData(wixSiteId);
    logger.info({ wixSiteId }, "APP_REMOVED: site data deleted");
  }

  res.status(200).json({ ok: true });
});
