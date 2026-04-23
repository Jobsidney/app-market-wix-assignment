import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

type RequestWithRaw = Request & { rawBody?: Buffer };

function firstHeaderValue(value: string | undefined): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function stripDefaultPort(host: string, protocol: string): string {
  if (!host) return host;
  if (protocol === "https" && host.endsWith(":443")) return host.slice(0, -4);
  if (protocol === "http" && host.endsWith(":80")) return host.slice(0, -3);
  return host;
}

export function verifyHubspotSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.header("x-hubspot-signature-v3")?.trim() ?? "";
  const timestamp = req.header("x-hubspot-request-timestamp")?.trim() ?? "";
  if (!signature || !timestamp) {
    res.status(401).json({ error: "Missing HubSpot webhook signature headers" });
    return;
  }
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
    res.status(401).json({ error: "Expired HubSpot webhook timestamp" });
    return;
  }
  const raw = (req as RequestWithRaw).rawBody;
  if (!raw) {
    res.status(401).json({ error: "Missing raw request body for signature check" });
    return;
  }
  const forwardedProto = firstHeaderValue(req.header("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(req.header("x-forwarded-host"));
  const protocol = forwardedProto || req.protocol || "https";
  const host = stripDefaultPort(forwardedHost || (req.get("host") ?? ""), protocol);
  const fullUri = `${protocol}://${host}${req.originalUrl}`;
  const source = `${req.method}${fullUri}${raw.toString("utf8")}${timestamp}`;
  const expected = crypto.createHmac("sha256", env.HUBSPOT_CLIENT_SECRET).update(source).digest("base64");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    res.status(401).json({ error: "Invalid HubSpot signature" });
    return;
  }
  next();
}
