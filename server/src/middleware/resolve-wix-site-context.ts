import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { getInstanceIdFromPayload, getMetaSiteIdFromPayload, parseWixInstancePayloadUnsigned, verifyWixSignedInstance } from "../lib/wix-app-instance.js";

function applyCanonicalSiteId(resolved: string): string {
  const canonical = env.WIX_CANONICAL_SITE_ID?.trim();
  return canonical || resolved;
}

export function resolveWixSiteContext(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const auth = req.header("authorization")?.trim();
  if (auth && auth.includes(".") && env.WIX_APP_SECRET) {
    const payload = verifyWixSignedInstance(auth, env.WIX_APP_SECRET);
    if (!payload) {
      res.status(401).json({ error: "Invalid Wix signed app instance" });
      return;
    }
    if (payload.aid && !payload.uid) {
      res.status(403).json({ error: "Anonymous dashboard access is not allowed" });
      return;
    }
    const instanceId = getInstanceIdFromPayload(payload);
    if (!instanceId) {
      res.status(401).json({ error: "Signed instance missing instanceId" });
      return;
    }
    res.locals.wixSiteId = applyCanonicalSiteId(instanceId);
    const metaSiteId = getMetaSiteIdFromPayload(payload);
    if (metaSiteId) {
      res.locals.wixMetaSiteId = metaSiteId;
    }
    next();
    return;
  }
  if (env.WIX_APP_SECRET) {
    res.status(401).json({ error: "Missing Authorization signed app instance" });
    return;
  }
  const headerSite = req.header("x-wix-site-id")?.trim();
  if (!headerSite) {
    if (auth && auth.includes(".")) {
      const payload = parseWixInstancePayloadUnsigned(auth);
      const instanceId = payload ? getInstanceIdFromPayload(payload) : null;
      if (instanceId) {
        res.locals.wixSiteId = applyCanonicalSiteId(instanceId);
        const metaSiteId = payload ? getMetaSiteIdFromPayload(payload) : null;
        if (metaSiteId) {
          res.locals.wixMetaSiteId = metaSiteId;
        }
        next();
        return;
      }
    }
    res.status(400).json({ error: "Missing x-wix-site-id header" });
    return;
  }
  res.locals.wixSiteId = applyCanonicalSiteId(headerSite);
  next();
}
