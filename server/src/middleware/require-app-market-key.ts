import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireAppMarketKey(req: Request, res: Response, next: NextFunction): void {
  if (env.WIX_APP_SECRET) {
    next();
    return;
  }
  if (!env.APP_MARKET_API_KEY) {
    next();
    return;
  }
  const key = req.header("x-app-market-key");
  if (key !== env.APP_MARKET_API_KEY) {
    res.status(401).json({ error: "Invalid or missing x-app-market-key" });
    return;
  }
  next();
}
