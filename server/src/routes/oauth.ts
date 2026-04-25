import { Router } from "express";
import { logger } from "../lib/logger.js";
import { exchangeAuthCode } from "../services/hubspot-auth.js";

export const oauthRouter = Router();

function readSingleQueryValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first.trim() : null;
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderOauthCallbackPage(connected: boolean, details?: string): string {
  const statusText = connected ? "HubSpot connected successfully. You can return to Wix now." : "HubSpot connection failed.";
  const statusPayload = connected ? "connected" : "error";
  const extraDetails = !connected && details ? `<p class="hint">${escapeHtml(details)}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HubSpot OAuth</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(520px, 100%); background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; text-align: center; }
      .title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
      .copy { font-size: 14px; color: #cbd5e1; margin: 0 0 12px; }
      .hint { font-size: 12px; color: #94a3b8; margin: 0; }
      .ok { color: #22c55e; }
      .bad { color: #ef4444; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <p class="title ${connected ? "ok" : "bad"}">${connected ? "Connected" : "Connection Error"}</p>
        <p class="copy">${statusText}</p>
        ${extraDetails}
        <p class="hint">This window will close automatically.</p>
      </div>
    </div>
    <script>
      try {
        window.opener?.postMessage({ source: "wix-hubspot-sync", type: "${statusPayload}" }, "*");
      } catch (_) {}
      setTimeout(() => {
        window.close();
      }, 500);
    </script>
  </body>
</html>`;
}

oauthRouter.get("/hubspot/callback", async (req, res, next) => {
  try {
    const oauthError = readSingleQueryValue(req.query.error);
    const oauthErrorDescription = readSingleQueryValue(req.query.error_description);
    if (oauthError) {
      const userFacingError = oauthErrorDescription
        ? `HubSpot returned: ${oauthErrorDescription}`
        : `HubSpot returned: ${oauthError}`;
      res.status(200).type("html").send(renderOauthCallbackPage(false, userFacingError));
      return;
    }

    const code = readSingleQueryValue(req.query.code);
    const wixSiteId = readSingleQueryValue(req.query.state);
    if (!code || !wixSiteId) {
      res.status(400).type("html").send(renderOauthCallbackPage(false, "Missing OAuth code or state."));
      return;
    }
    await exchangeAuthCode(code, wixSiteId);
    res.status(200).type("html").send(renderOauthCallbackPage(true));
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Unknown OAuth callback error.";
    logger.error({
      message,
      codePresent: Boolean(readSingleQueryValue(req.query.code)),
      statePresent: Boolean(readSingleQueryValue(req.query.state)),
    }, "HubSpot OAuth callback failed");
    res.status(200).type("html").send(renderOauthCallbackPage(false, message));
  }
});
