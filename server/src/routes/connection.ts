import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { env } from "../config/env.js";
import { ensureAuthenticated } from "../middleware/ensure-authenticated.js";
import { requireAppMarketKey } from "../middleware/require-app-market-key.js";
import { resolveWixSiteContext } from "../middleware/resolve-wix-site-context.js";
import { getSiteSyncLiveEnabled, setSiteSyncLiveEnabled } from "../services/site-sync-state-repo.js";
import { getHubspotEmbedSettings, upsertHubspotEmbedSettings } from "../services/hubspot-embed-repo.js";

export const connectionRouter = Router();

connectionRouter.use(resolveWixSiteContext);

connectionRouter.get("/status", async (_req, res, next) => {
  try {
    const resolvedSiteId = res.locals.wixSiteId as string;
    const wixSiteId = env.WIX_CANONICAL_SITE_ID?.trim() || resolvedSiteId;
    const result = await db.query("select 1 from oauth_installations where wix_site_id = $1", [wixSiteId]);
    res.status(200).json({ connected: Boolean(result.rowCount) });
  } catch (error) {
    next(error);
  }
});

connectionRouter.get("/authorize-url", (_req, res) => {
  const resolvedSiteId = res.locals.wixSiteId as string;
  const wixSiteId = env.WIX_CANONICAL_SITE_ID?.trim() || resolvedSiteId;
  const redirectUri = encodeURIComponent(env.HUBSPOT_REDIRECT_URI);
  const scopes = encodeURIComponent("crm.objects.contacts.read crm.objects.contacts.write oauth");
  const url = `https://app.hubspot.com/oauth/authorize?client_id=${env.HUBSPOT_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes}&state=${encodeURIComponent(wixSiteId)}`;
  res.status(200).json({ authorizeUrl: url });
});

connectionRouter.delete("/", requireAppMarketKey, ensureAuthenticated, async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    await db.query("delete from oauth_installations where wix_site_id = $1", [wixSiteId]);
    res.status(200).json({ connected: false });
  } catch (error) {
    next(error);
  }
});

connectionRouter.get("/sync-live", async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const live = await getSiteSyncLiveEnabled(wixSiteId);
    res.status(200).json({ live });
  } catch (error) {
    next(error);
  }
});

connectionRouter.patch("/sync-live", requireAppMarketKey, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const parsed = z.object({ live: z.boolean() }).parse(req.body ?? {});
    await setSiteSyncLiveEnabled(wixSiteId, parsed.live);
    res.status(200).json({ live: parsed.live });
  } catch (error) {
    next(error);
  }
});

const embedSchema = z.object({
  portalId: z.string().min(1),
  formId: z.string().min(1),
  region: z.enum(["na1", "eu1", "ap1"]),
});

connectionRouter.get("/hubspot-embed", requireAppMarketKey, async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const saved = await getHubspotEmbedSettings(wixSiteId);
    res.status(200).json(saved ?? { portalId: "", formId: "", region: "na1" });
  } catch (error) {
    next(error);
  }
});

connectionRouter.put("/hubspot-embed", requireAppMarketKey, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const parsed = embedSchema.parse(req.body ?? {});
    await upsertHubspotEmbedSettings(wixSiteId, {
      portalId: parsed.portalId.trim(),
      formId: parsed.formId.trim(),
      region: parsed.region,
    });
    const saved = await getHubspotEmbedSettings(wixSiteId);
    res.status(200).json(saved);
  } catch (error) {
    next(error);
  }
});
