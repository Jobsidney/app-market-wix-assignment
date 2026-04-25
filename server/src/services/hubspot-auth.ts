import { Client } from "@hubspot/api-client";
import { db } from "../lib/db.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { decodeAccessTokenFromStorage, encodeAccessTokenForStorage } from "../lib/access-token-storage.js";
import { env } from "../config/env.js";
import { assertValidWixMetaSiteId } from "../lib/wix-site-id.js";

interface InstallationRecord {
  wix_site_id: string;
  access_token: string;
  refresh_token_encrypted: string;
  expires_at: string;
  hubspot_portal_id: string | null;
}

function createHubspotClient(accessToken?: string): Client {
  return new Client({ accessToken });
}

async function fetchHubspotPortalId(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { hub_id?: number | string; hubId?: number | string };
    const hubId = payload.hub_id ?? payload.hubId;
    return typeof hubId === "undefined" || hubId === null ? null : String(hubId);
  } catch {
    return null;
  }
}

export async function exchangeAuthCode(code: string, wixSiteId: string): Promise<void> {
  assertValidWixMetaSiteId(wixSiteId, "exchangeAuthCode");
  const response = await createHubspotClient().oauth.tokensApi.create(
    "authorization_code",
    code,
    env.HUBSPOT_REDIRECT_URI,
    env.HUBSPOT_CLIENT_ID,
    env.HUBSPOT_CLIENT_SECRET,
  );
  const expiresAt = new Date(Date.now() + response.expiresIn * 1000).toISOString();
  const tokenHubId = (response as { hubId?: number | string; hub_id?: number | string }).hubId ??
    (response as { hubId?: number | string; hub_id?: number | string }).hub_id;
  const hubspotPortalId =
    typeof tokenHubId !== "undefined" && tokenHubId !== null
      ? String(tokenHubId)
      : await fetchHubspotPortalId(response.accessToken);
  if (hubspotPortalId) {
    await db.query(
      "delete from oauth_installations where hubspot_portal_id = $1 and wix_site_id <> $2",
      [hubspotPortalId, wixSiteId],
    );
  }
  const encodedAccessToken = encodeAccessTokenForStorage(response.accessToken);
  const encryptedRefreshToken = encrypt(response.refreshToken);

  await db.query("begin");
  try {
    if (hubspotPortalId) {
      // Reconnect flow: ensure a single portal maps to one site without violating unique portal index.
      await db.query("delete from oauth_installations where wix_site_id = $1 or hubspot_portal_id = $2", [
        wixSiteId,
        hubspotPortalId,
      ]);
      await db.query(
        `insert into oauth_installations (wix_site_id, access_token, refresh_token_encrypted, expires_at, hubspot_portal_id)
         values ($1, $2, $3, $4, $5)`,
        [wixSiteId, encodedAccessToken, encryptedRefreshToken, expiresAt, hubspotPortalId],
      );
    } else {
      await db.query(
        `insert into oauth_installations (wix_site_id, access_token, refresh_token_encrypted, expires_at, hubspot_portal_id)
         values ($1, $2, $3, $4, $5)
         on conflict (wix_site_id)
         do update set access_token = excluded.access_token,
                       refresh_token_encrypted = excluded.refresh_token_encrypted,
                       expires_at = excluded.expires_at,
                       hubspot_portal_id = coalesce(excluded.hubspot_portal_id, oauth_installations.hubspot_portal_id),
                       updated_at = now()`,
        [wixSiteId, encodedAccessToken, encryptedRefreshToken, expiresAt, hubspotPortalId],
      );
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

export async function getValidAccessToken(wixSiteId: string): Promise<string> {
  const result = await db.query<InstallationRecord>(
    "select wix_site_id, access_token, refresh_token_encrypted, expires_at, hubspot_portal_id from oauth_installations where wix_site_id = $1",
    [wixSiteId],
  );
  const installation = result.rows[0];
  if (!installation) {
    throw new Error("HubSpot installation not found for site");
  }
  if (new Date(installation.expires_at).getTime() > Date.now() + 30_000) {
    const validToken = decodeAccessTokenFromStorage(installation.access_token);
    if (!installation.hubspot_portal_id) {
      const portalId = await fetchHubspotPortalId(validToken);
      if (portalId) {
        await db.query(
          `update oauth_installations set hubspot_portal_id = $2, updated_at = now() where wix_site_id = $1`,
          [wixSiteId, portalId],
        );
      }
    }
    return validToken;
  }
  const refreshToken = decrypt(installation.refresh_token_encrypted);
  const refreshed = await createHubspotClient().oauth.tokensApi.create(
    "refresh_token",
    undefined,
    env.HUBSPOT_REDIRECT_URI,
    env.HUBSPOT_CLIENT_ID,
    env.HUBSPOT_CLIENT_SECRET,
    refreshToken,
  );
  const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
  const refreshedPortalId = await fetchHubspotPortalId(refreshed.accessToken);
  await db.query(
    `update oauth_installations
      set access_token = $2,
          refresh_token_encrypted = $3,
          expires_at = $4,
          hubspot_portal_id = coalesce($5, hubspot_portal_id),
          updated_at = now()
      where wix_site_id = $1`,
    [
      wixSiteId,
      encodeAccessTokenForStorage(refreshed.accessToken),
      encrypt(refreshed.refreshToken),
      expiresAt,
      refreshedPortalId,
    ],
  );
  return refreshed.accessToken;
}

export async function resolveWixSiteIdByHubspotPortalId(hubspotPortalId: string): Promise<string | null> {
  const direct = await db.query<{ wix_site_id: string }>(
    "select wix_site_id from oauth_installations where hubspot_portal_id = $1 limit 1",
    [hubspotPortalId],
  );
  if (direct.rows[0]) {
    return direct.rows[0].wix_site_id;
  }
  return null;
}
