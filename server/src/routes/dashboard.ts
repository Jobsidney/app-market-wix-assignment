import { Router } from "express";
import { ensureAuthenticated } from "../middleware/ensure-authenticated.js";
import { requireAppMarketKey } from "../middleware/require-app-market-key.js";
import { resolveWixSiteContext } from "../middleware/resolve-wix-site-context.js";
import { getHubspotProperties } from "../services/hubspot-properties-cache.js";
import { db } from "../lib/db.js";
import {
  createSyncDefinition,
  deleteSyncDefinition,
  getDefaultSyncId,
  listSyncDefinitions,
  updateSyncDefinition,
} from "../services/sync-definitions-repo.js";
import { z } from "zod";

export const dashboardRouter = Router();

dashboardRouter.use(resolveWixSiteContext);
dashboardRouter.use(requireAppMarketKey);

dashboardRouter.get("/hubspot/properties", ensureAuthenticated, async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const raw = await getHubspotProperties(wixSiteId, res.locals.hubspotAccessToken as string);
    const properties = (raw as Array<{ name?: string; label?: string }>)
      .map((p) => ({
        name: String(p.name ?? ""),
        label: String(p.label ?? p.name ?? ""),
      }))
      .filter((p) => p.name.length > 0);
    res.status(200).json({ properties });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/sync-jobs", ensureAuthenticated, async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const rawSyncId = _req.query.syncId;
    const syncId =
      typeof rawSyncId === "string" && rawSyncId.trim().length > 0
        ? Number(rawSyncId)
        : await getDefaultSyncId(wixSiteId);
    if (!Number.isFinite(syncId)) {
      res.status(400).json({ error: "Invalid syncId query parameter" });
      return;
    }
    const result = await db.query(
      `select id, job_type, status, attempts, created_at, payload, last_error,
              coalesce(payload->>'source', '') as event_source
       from sync_jobs
       where wix_site_id = $1 and sync_id = $2
       order by id desc
       limit 40`,
      [wixSiteId, syncId],
    );
    const managedCountResult = await db.query<{ count: string }>(
      `select count(distinct record_key)::text as count
       from (
         select coalesce(
           nullif(payload->>'wixContactId', ''),
           nullif(payload->>'hubspotContactId', ''),
           nullif(payload->>'submissionId', '')
         ) as record_key
         from sync_jobs
         where wix_site_id = $1 and sync_id = $2
       ) managed_records
       where record_key is not null`,
      [wixSiteId, syncId],
    );
    res.status(200).json({
      jobs: result.rows,
      managedRecordsCount: Number(managedCountResult.rows[0]?.count ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/syncs", ensureAuthenticated, async (_req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const syncs = await listSyncDefinitions(wixSiteId);
    res.status(200).json({ syncs });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.post("/syncs", ensureAuthenticated, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const parsed = z.object({ name: z.string().min(1).default("New Sync") }).parse(req.body ?? {});
    const sync = await createSyncDefinition(wixSiteId, parsed.name);
    res.status(201).json({ sync });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.patch("/syncs/:id", ensureAuthenticated, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const syncId = Number(req.params.id);
    if (!Number.isFinite(syncId)) {
      res.status(400).json({ error: "Invalid sync id" });
      return;
    }
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        live: z.boolean().optional(),
        syncOption: z.string().optional(),
        syncDirection: z.string().optional(),
        existingRecordPolicy: z.string().optional(),
        hubspotEntity: z.string().min(1).optional(),
        wixEntity: z.string().min(1).optional(),
      })
      .parse(req.body ?? {});
    const sync = await updateSyncDefinition(wixSiteId, syncId, parsed);
    if (!sync) {
      res.status(404).json({ error: "Sync not found" });
      return;
    }
    res.status(200).json({ sync });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.delete("/syncs/:id", ensureAuthenticated, async (req, res, next) => {
  try {
    const wixSiteId = res.locals.wixSiteId as string;
    const syncId = Number(req.params.id);
    if (!Number.isFinite(syncId)) {
      res.status(400).json({ error: "Invalid sync id" });
      return;
    }
    const deleted = await deleteSyncDefinition(wixSiteId, syncId);
    if (!deleted) {
      res.status(404).json({ error: "Sync not found" });
      return;
    }
    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.delete("/sync-configuration", ensureAuthenticated, async (_req, res, next) => {
  const wixSiteId = res.locals.wixSiteId as string;
  await db.query("begin");
  try {
    const shadowRows = await db.query<{ wix_contact_id: string }>(
      "select wix_contact_id from wix_contacts_shadow where wix_site_id = $1",
      [wixSiteId],
    );
    const shadowContactIds = shadowRows.rows.map((r) => r.wix_contact_id);
    if (shadowContactIds.length > 0) {
      await db.query("delete from sync_mapping where wix_contact_id = any($1::text[])", [shadowContactIds]);
    }
    await db.query("delete from sync_jobs where wix_site_id = $1", [wixSiteId]);
    await db.query("delete from field_mappings where wix_site_id = $1", [wixSiteId]);
    await db.query("delete from form_submission_events where wix_site_id = $1", [wixSiteId]);
    await db.query("delete from hubspot_embed_settings where wix_site_id = $1", [wixSiteId]);
    await db.query("delete from site_sync_state where wix_site_id = $1", [wixSiteId]);
    await db.query("delete from wix_contacts_shadow where wix_site_id = $1", [wixSiteId]);
    await db.query("commit");
    res.status(200).json({ deleted: true });
  } catch (error) {
    await db.query("rollback");
    next(error);
  }
});
