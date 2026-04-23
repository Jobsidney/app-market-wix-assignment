import { Router } from "express";
import { z } from "zod";
import { ensureAuthenticated } from "../middleware/ensure-authenticated.js";
import { requireAppMarketKey } from "../middleware/require-app-market-key.js";
import { resolveWixSiteContext } from "../middleware/resolve-wix-site-context.js";
import { listFieldMappings, replaceFieldMappings } from "../services/field-mapping-repo.js";
import { getDefaultSyncId } from "../services/sync-definitions-repo.js";

const mappingSchema = z.object({
  wixField: z.string().min(1),
  hubspotField: z.string().min(1),
  syncDirection: z.enum(["wix_to_hubspot", "hubspot_to_wix", "bidirectional"]),
  transformRule: z.string().optional().nullable(),
});

export const mappingsRouter = Router();

mappingsRouter.use(resolveWixSiteContext);
mappingsRouter.use(requireAppMarketKey);

mappingsRouter.get("/", ensureAuthenticated, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const rawSyncId = req.query.syncId;
    const syncId =
      typeof rawSyncId === "string" && rawSyncId.trim().length > 0
        ? Number(rawSyncId)
        : await getDefaultSyncId(wixSiteId);
    if (!Number.isFinite(syncId)) {
      res.status(400).json({ error: "Invalid syncId query parameter" });
      return;
    }
    const mappings = await listFieldMappings(wixSiteId, syncId);
    res.status(200).json({ mappings });
  } catch (error) {
    next(error);
  }
});

mappingsRouter.put("/", ensureAuthenticated, async (req, res, next) => {
  try {
    const parsed = z.array(mappingSchema).parse(req.body?.mappings ?? []);
    const duplicates = new Set<string>();
    for (const row of parsed) {
      if (duplicates.has(row.hubspotField)) {
        res.status(400).json({ error: `Duplicate HubSpot property mapping is not allowed: ${row.hubspotField}` });
        return;
      }
      duplicates.add(row.hubspotField);
    }
    const wixSiteId = res.locals.wixSiteId as string;
    const rawSyncId = req.query.syncId;
    const syncId =
      typeof rawSyncId === "string" && rawSyncId.trim().length > 0
        ? Number(rawSyncId)
        : await getDefaultSyncId(wixSiteId);
    if (!Number.isFinite(syncId)) {
      res.status(400).json({ error: "Invalid syncId query parameter" });
      return;
    }
    const mappings = await replaceFieldMappings(
      wixSiteId,
      syncId,
      parsed.map((row) => ({ ...row, transformRule: row.transformRule ?? null })),
    );
    res.status(200).json({ mappings });
  } catch (error) {
    next(error);
  }
});
