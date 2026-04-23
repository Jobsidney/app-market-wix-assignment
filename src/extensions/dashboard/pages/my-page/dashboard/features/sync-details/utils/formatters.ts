import { getSyncJobAction } from "../../../shared/sync-job-utils";
import { getSyncDirectionArrow } from "../../../shared/sync-name-utils";
import type { SyncDirection, SyncJob } from "../../../shared/types";

export type PreviewMappingRow = {
  id: string | number;
  hubspotField: string;
  wixField: string;
  direction: SyncDirection;
};

const prettifyKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

export function humanLabelForKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  const labels: Record<string, string> = {
    firstname: "First name",
    lastname: "Last name",
    email: "Email",
    phone: "Phone",
    website: "Website",
    jobtitle: "Job title",
    utm_source: "UTM source",
    utm_medium: "UTM medium",
    utm_campaign: "UTM campaign",
    utm_term: "UTM term",
    utm_content: "UTM content",
    pageurl: "Page URL",
    referrer: "Referrer",
    syncid: "Sync ID",
    hubspotportalid: "HubSpot portal ID",
  };
  return labels[normalized] ?? prettifyKey(key);
}

export const getDirectionGlyph = (direction: SyncDirection) => getSyncDirectionArrow(direction);

export const getJobRowActionLabel = (job: SyncJob) => (getSyncJobAction(job) === "create" ? "Create" : "Update");

function shouldHidePayloadKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return [
    "data",
    "payload",
    "_context",
    "_identitycontext",
    "configuration",
    "identitycontext",
    "context",
    "trigger",
  ].includes(normalized);
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const raw = JSON.stringify(value);
    return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
  } catch {
    return String(value);
  }
}

export function buildJobDetailLines(job: SyncJob): string[] {
  const payload = job.payload ?? {};
  const coreLines: string[] = [];
  const maybeWixId = typeof payload.wixContactId === "string" ? payload.wixContactId : null;
  const maybeHubspotId = typeof payload.hubspotContactId === "string" ? payload.hubspotContactId : null;

  if (maybeWixId) {
    coreLines.push(`Wix Contact ID: ${maybeWixId}`);
  }
  if (maybeHubspotId) {
    coreLines.push(`HubSpot Contact ID: ${maybeHubspotId}`);
  }

  const skipKeys = new Set(["wixContactId", "hubspotContactId", "source", "correlationId", "updatedAt", "currentRemoteState"]);
  const fieldLines = Object.entries(payload)
    .filter(([key, value]) => !skipKeys.has(key) && !shouldHidePayloadKey(key) && value !== null && value !== undefined)
    .map(([key, value]) => [key, formatDetailValue(value)] as const)
    .filter(([, value]) => value.length > 0)
    .slice(0, 8)
    .map(([key, value]) => `Field: ${humanLabelForKey(key)}; New value: ${value};`);

  if (job.last_error) {
    fieldLines.push(`Error: ${job.last_error}`);
  }

  const lines = [...coreLines, ...fieldLines];
  if (lines.length === 0) {
    lines.push("No additional payload details captured for this event.");
  }

  return lines;
}
