import { config } from "dotenv";
import { Client } from "@hubspot/api-client";
import { SubscriptionCreateRequestEventTypeEnum } from "@hubspot/api-client/lib/codegen/webhooks/models/SubscriptionCreateRequest.js";
import { db } from "../lib/db.js";
import { getValidAccessToken } from "../services/hubspot-auth.js";

config();

async function main(): Promise<void> {
  const appId = Number(process.env.HUBSPOT_APP_ID);
  const wixSiteId = process.argv.find((a) => a.startsWith("--wix-site-id="))?.split("=")[1]?.trim();
  if (!wixSiteId || !Number.isFinite(appId) || appId <= 0) {
    console.error("Usage: npm run hubspot:register-webhooks -- --wix-site-id=<your_wix_instance_id>");
    console.error("Env: HUBSPOT_APP_ID (numeric HubSpot developer app ID).");
    console.error("Auth: HUBSPOT_DEVELOPER_API_KEY (recommended for webhooks v3 API) OR OAuth row for wix_site_id.");
    process.exit(1);
  }

  const devKey = process.env.HUBSPOT_DEVELOPER_API_KEY?.trim();
  const client = devKey
    ? new Client({ developerApiKey: devKey })
    : new Client({ accessToken: await getValidAccessToken(wixSiteId) });

  const properties = (process.env.HUBSPOT_WEBHOOK_PROPERTIES?.trim() || "email,firstname,lastname,phone,jobtitle")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const propertyName of properties) {
    const created = await client.webhooks.subscriptionsApi.create(appId, {
      eventType: SubscriptionCreateRequestEventTypeEnum.ContactPropertyChange,
      active: true,
      propertyName,
    });
    console.log("Created subscription:", created.id, created.eventType, created.propertyName, created.active);
  }
  await db.end();
}

void main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await db.end().catch(() => {});
  process.exit(1);
});
