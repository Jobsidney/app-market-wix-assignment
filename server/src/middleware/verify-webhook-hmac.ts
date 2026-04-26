import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

type RequestWithRaw = Request & { rawBody?: Buffer };

export function verifyWebhookHmac(req: Request, res: Response, next: NextFunction): void {
  const body = (req.body as Record<string, unknown> | undefined) ?? {};
  const wixAutomationKeyHeader = req.header("x-wix-automation-key")?.trim() ?? "";
  const wixAutomationKeyBody =
    typeof body.wixAutomationKey === "string" ? body.wixAutomationKey.trim() : "";
  const wixAutomationKeyQuery = typeof req.query.wixKey === "string" ? req.query.wixKey.trim() : "";
  const wixAutomationKey = wixAutomationKeyHeader || wixAutomationKeyBody || wixAutomationKeyQuery;
  if (
    req.path.startsWith("/wix/") &&
    env.WIX_AUTOMATION_WEBHOOK_KEY?.trim() &&
    wixAutomationKey &&
    wixAutomationKey === env.WIX_AUTOMATION_WEBHOOK_KEY.trim()
  ) {
    next();
    return;
  }
  // Wix Dev Center app webhooks: verified via x-wix-signature header (HMAC-SHA256 of raw body using WIX_APP_SECRET)
  if (req.path.startsWith("/wix/") && env.WIX_APP_SECRET) {
    const wixSig = req.header("x-wix-signature")?.trim() ?? "";
    if (wixSig) {
      const raw = (req as RequestWithRaw).rawBody;
      if (raw) {
        const expected = crypto.createHmac("sha256", env.WIX_APP_SECRET).update(raw).digest("base64");
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(wixSig))) {
          next();
          return;
        }
      }
      res.status(401).json({ error: "Invalid Wix app webhook signature" });
      return;
    }
    // No signature header — allow through if WEBHOOK_HMAC_SECRET is also not set (dev/test)
    if (!env.WEBHOOK_HMAC_SECRET) {
      next();
      return;
    }
  }
  if (!env.WEBHOOK_HMAC_SECRET) {
    next();
    return;
  }
  const sigHeader = req.header("x-sync-signature")?.trim() ?? "";
  const hex = sigHeader.startsWith("sha256=") ? sigHeader.slice("sha256=".length) : sigHeader;
  const raw = (req as RequestWithRaw).rawBody;
  if (!raw || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    res.status(401).json({ error: "Missing or invalid x-sync-signature" });
    return;
  }
  const expected = crypto.createHmac("sha256", env.WEBHOOK_HMAC_SECRET).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hex, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }
  next();
}
