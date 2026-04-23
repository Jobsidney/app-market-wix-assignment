import type { SyncJob } from "./types";

function looksLikeCreateSignal(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("new_contact_was_created") ||
    normalized.includes("contact_created") ||
    normalized.includes("contact.creation") ||
    normalized.endsWith(".created") ||
    normalized.endsWith(".creation") ||
    normalized.includes("contact.create")
  );
}

export function isCreateSyncEvent(job: SyncJob): boolean {
  if (job.job_type === "form_submission") {
    return true;
  }
  if (!job.payload) {
    return false;
  }
  const queue: unknown[] = [job.payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (typeof value === "string") {
        if (
          normalizedKey === "actionid" ||
          normalizedKey === "eventtype" ||
          normalizedKey === "triggerkey" ||
          normalizedKey === "action" ||
          normalizedKey === "event" ||
          normalizedKey === "subscriptiontype"
        ) {
          if (looksLikeCreateSignal(value)) {
            return true;
          }
        }
        if (looksLikeCreateSignal(value)) {
          return true;
        }
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return false;
}

export function getSyncJobAction(job: SyncJob): "create" | "update" {
  return isCreateSyncEvent(job) ? "create" : "update";
}
