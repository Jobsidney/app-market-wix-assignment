import type { NextFunction, Request, Response } from "express";
import { getValidAccessToken } from "../services/hubspot-auth.js";

export async function ensureAuthenticated(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wixSiteId =
      typeof res.locals.wixSiteId === "string" && res.locals.wixSiteId.trim()
        ? res.locals.wixSiteId.trim()
        : req.header("x-wix-site-id")?.trim();
    if (!wixSiteId) {
      res.status(400).json({ error: "Missing site context (signed instance or x-wix-site-id)" });
      return;
    }
    const accessToken = await getValidAccessToken(wixSiteId);
    res.locals.hubspotAccessToken = accessToken;
    res.locals.wixSiteId = wixSiteId;
    next();
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
