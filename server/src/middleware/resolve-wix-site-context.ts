import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { getInstanceIdFromPayload, parseWixInstancePayloadUnsigned, verifyWixSignedInstance } from "../lib/wix-app-instance.js";
import { isValidWixMetaSiteId } from "../lib/wix-site-id.js";

export function resolveWixSiteContext(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const headerSite = req.header("x-wix-site-id")?.trim();
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
    const payloadSiteId = getInstanceIdFromPayload(payload);
    const headerOk = headerSite && isValidWixMetaSiteId(headerSite) ? headerSite : "";
    const resolvedSiteId = headerOk || payloadSiteId;
    if (!resolvedSiteId) {
      res.status(401).json({ error: "Signed instance missing site context" });
      return;
    }
    res.locals.wixSiteId = resolvedSiteId;
    next();
    return;
  }
  if (env.WIX_APP_SECRET) {
    res.status(401).json({ error: "Missing Authorization signed app instance" });
    return;
  }
  if (!headerSite) {
    if (auth && auth.includes(".")) {
      const payload = parseWixInstancePayloadUnsigned(auth);
      const instanceId = payload ? getInstanceIdFromPayload(payload) : null;
      if (instanceId) {
        res.locals.wixSiteId = instanceId;
        next();
        return;
      }
    }
    res.status(400).json({ error: "Missing x-wix-site-id header" });
    return;
  }
  res.locals.wixSiteId = headerSite;
  next();
}
