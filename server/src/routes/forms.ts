import { Router } from "express";
import { enqueueJob } from "../services/sync-job-queue.js";
import { getSiteSyncLiveEnabled } from "../services/site-sync-state-repo.js";
import { verifyWebhookHmac } from "../middleware/verify-webhook-hmac.js";

export const formsRouter = Router();

formsRouter.use(verifyWebhookHmac);

formsRouter.post("/wix/submission", async (req, res, next) => {
  try {
    const wixSiteId = req.header("x-wix-site-id");
    if (!wixSiteId) {
      res.status(400).json({ error: "Missing x-wix-site-id header" });
      return;
    }
    if (!(await getSiteSyncLiveEnabled(wixSiteId))) {
      res.status(200).json({ accepted: true, skipped: "sync_paused" });
      return;
    }
    res.status(200).json({ accepted: true });
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const syncId = typeof payload.syncId === "number" ? payload.syncId : Number(payload.syncId ?? NaN);
    await enqueueJob(wixSiteId, "form_submission", payload, Number.isFinite(syncId) ? syncId : undefined);
  } catch (error) {
    next(error);
  }
});
