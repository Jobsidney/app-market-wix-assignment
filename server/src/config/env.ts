import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  HUBSPOT_CLIENT_ID: z.string().min(1),
  HUBSPOT_CLIENT_SECRET: z.string().min(1),
  HUBSPOT_REDIRECT_URI: z.string().url(),
  APP_INTERNAL_ID: z.string().default("wix-hubspot-integration"),
  /** When set, dashboard + mapping + dashboard routes require matching `x-app-market-key` header. */
  APP_MARKET_API_KEY: z.string().optional(),
  /** When set, `/webhooks/*` and `/forms/*` require `x-sync-signature: <hex>` = HMAC-SHA256(raw body, secret). */
  WEBHOOK_HMAC_SECRET: z.string().optional(),
  /** Optional static secret for Wix Automations webhook calls when HMAC cannot be computed. */
  WIX_AUTOMATION_WEBHOOK_KEY: z.string().optional(),
  /** Wix API key auth for outbound CRM calls (Contacts v4). If unset, HubSpot→Wix updates shadow DB only. */
  WIX_API_KEY: z.string().optional(),
  /** App secret from the Wix app OAuth page; when set, dashboard/mappings/connection require `Authorization: <signed instance>`. */
  WIX_APP_SECRET: z.string().optional(),
  /**
   * `locked`: fail fast at boot unless `APP_MARKET_API_KEY` and `WEBHOOK_HMAC_SECRET` are set (assignment-grade hardening).
   * `standard`: optional keys (local dev friendly).
   */
  SYNC_SECURITY_MODE: z.enum(["standard", "locked"]).default("standard"),
});

export const env = envSchema.parse(process.env);

export function assertSyncSecurityEnv(): void {
  if (env.SYNC_SECURITY_MODE !== "locked") {
    return;
  }
  if (!env.WEBHOOK_HMAC_SECRET?.trim()) {
    throw new Error("SYNC_SECURITY_MODE=locked requires WEBHOOK_HMAC_SECRET");
  }
  if (!env.APP_MARKET_API_KEY?.trim() && !env.WIX_APP_SECRET?.trim()) {
    throw new Error("SYNC_SECURITY_MODE=locked requires WIX_APP_SECRET and/or APP_MARKET_API_KEY");
  }
}
