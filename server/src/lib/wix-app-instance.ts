import crypto from "node:crypto";

function b64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export function verifyWixSignedInstance(instance: string, appSecret: string): Record<string, unknown> | null {
  const dot = instance.indexOf(".");
  if (dot <= 0 || dot >= instance.length - 1) {
    return null;
  }
  const sigPart = instance.slice(0, dot);
  const dataPart = instance.slice(dot + 1);
  const expected = crypto.createHmac("sha256", appSecret).update(dataPart, "utf8").digest();
  let sig: Buffer;
  try {
    sig = b64UrlToBuffer(sigPart);
  } catch {
    return null;
  }
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    return null;
  }
  let jsonStr: string;
  try {
    jsonStr = b64UrlToBuffer(dataPart).toString("utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseWixInstancePayloadUnsigned(instance: string): Record<string, unknown> | null {
  const dot = instance.indexOf(".");
  if (dot <= 0 || dot >= instance.length - 1) {
    return null;
  }
  const dataPart = instance.slice(dot + 1);
  let jsonStr: string;
  try {
    jsonStr = b64UrlToBuffer(dataPart).toString("utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getInstanceIdFromPayload(payload: Record<string, unknown>): string | null {
  const id = payload.instanceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
