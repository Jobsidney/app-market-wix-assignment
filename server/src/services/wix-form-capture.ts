import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { listFieldMappings } from "./field-mapping-repo.js";
import { transformByPersistedMappings } from "./mapping-transformer.js";
import { upsertHubspotContact } from "./hubspot-contacts.js";

export async function ingestFormSubmission(wixSiteId: string, payload: Record<string, unknown>, syncId: number): Promise<void> {
  const wixSubmissionId = String(payload.submissionId ?? "");
  if (!wixSubmissionId) {
    throw new Error("Missing submissionId for form submission event");
  }
  await db.query(
    `insert into form_submission_events (
      wix_site_id, wix_submission_id, wix_contact_id, page_url, referrer,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, payload
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    on conflict (wix_site_id, wix_submission_id) do nothing`,
    [
      wixSiteId,
      wixSubmissionId,
      payload.wixContactId ?? null,
      payload.pageUrl ?? null,
      payload.referrer ?? null,
      payload.utm_source ?? null,
      payload.utm_medium ?? null,
      payload.utm_campaign ?? null,
      payload.utm_term ?? null,
      payload.utm_content ?? null,
      JSON.stringify(payload),
    ],
  );
  const rows = await listFieldMappings(wixSiteId, syncId);
  let mappedForHubspot = transformByPersistedMappings(payload, rows, "wix_to_hubspot");
  if (Object.keys(mappedForHubspot).length === 0) {
    mappedForHubspot = {
      email: payload.email,
      firstname: payload.firstName ?? payload.name,
      lastname: payload.lastName,
      utm_source: payload.utm_source,
      utm_medium: payload.utm_medium,
      utm_campaign: payload.utm_campaign,
      utm_term: payload.utm_term,
      utm_content: payload.utm_content,
    };
  }
  try {
    await upsertHubspotContact(wixSiteId, mappedForHubspot);
  } catch (error) {
    logger.warn({ wixSubmissionId, error: error instanceof Error ? error.message : "unknown" }, "HubSpot upsert failed");
  }
  logger.info({ wixSiteId, wixSubmissionId }, "Stored Wix form submission metadata");
}
