import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { processSyncEvent } from "./sync-worker.js";
import { ingestFormSubmission } from "./wix-form-capture.js";
import { getDefaultSyncId, getSyncLiveEnabled } from "./sync-definitions-repo.js";

type JobStatus = "queued" | "processing" | "done" | "failed";
type JobType = "sync_event" | "form_submission";

interface DbJob {
  id: number;
  sync_id: number;
  wix_site_id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
}

let running = false;
let timer: NodeJS.Timeout | null = null;
const MAX_JOBS_PER_TICK = 8;

export async function enqueueJob(
  wixSiteId: string,
  jobType: JobType,
  payload: Record<string, unknown>,
  syncId?: number,
): Promise<void> {
  const resolvedSyncId = Number.isFinite(syncId) ? Number(syncId) : await getDefaultSyncId(wixSiteId);
  await db.query("insert into sync_jobs (sync_id, wix_site_id, job_type, payload) values ($1, $2, $3, $4::jsonb)", [
    resolvedSyncId,
    wixSiteId,
    jobType,
    JSON.stringify(payload),
  ]);
}

async function reserveJob(): Promise<DbJob | null> {
  const result = await db.query<DbJob>(
    `update sync_jobs
     set status = 'processing', attempts = attempts + 1, updated_at = now()
     where id = (
       select id from sync_jobs where status = 'queued' order by created_at asc limit 1 for update skip locked
     )
     returning id, sync_id, wix_site_id, job_type, payload, status, attempts`,
  );
  return result.rows[0] ?? null;
}

async function finalizeJob(id: number, status: Exclude<JobStatus, "processing">, lastError?: string): Promise<void> {
  await db.query("update sync_jobs set status = $2, last_error = $3, updated_at = now() where id = $1", [
    id,
    status,
    lastError ?? null,
  ]);
}

async function requeueJobWithoutAttemptPenalty(id: number): Promise<void> {
  await db.query(
    `update sync_jobs set status = 'queued', attempts = greatest(attempts - 1, 0), updated_at = now() where id = $1`,
    [id],
  );
}

function extractSyncEventContactPayload(envelope: Record<string, unknown>): Record<string, unknown> {
  const inner = envelope.payload;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  const skip = new Set([
    "wixContactId",
    "hubspotContactId",
    "correlationId",
    "source",
    "updatedAt",
    "currentRemoteState",
    "fieldMapping",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(envelope)) {
    if (!skip.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

function optTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

async function processJob(job: DbJob): Promise<void> {
  if (job.job_type === "sync_event") {
    await processSyncEvent({
      wixSiteId: job.wix_site_id,
      syncId: job.sync_id,
      wixContactId: optTrimmedString(job.payload.wixContactId),
      hubspotContactId: optTrimmedString(job.payload.hubspotContactId),
      correlationId: typeof job.payload.correlationId === "string" ? job.payload.correlationId : undefined,
      source: job.payload.source === "hubspot" ? "hubspot" : "wix",
      payload: extractSyncEventContactPayload(job.payload),
      currentRemoteState: (job.payload.currentRemoteState as Record<string, unknown>) ?? undefined,
      updatedAt: typeof job.payload.updatedAt === "string" ? job.payload.updatedAt : undefined,
    });
    return;
  }
  await ingestFormSubmission(job.wix_site_id, job.payload, job.sync_id);
}

async function workerTick(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    for (let processed = 0; processed < MAX_JOBS_PER_TICK; processed += 1) {
      const job = await reserveJob();
      if (!job) {
        break;
      }
      try {
        const live = await getSyncLiveEnabled(job.sync_id);
        if (!live && (job.job_type === "sync_event" || job.job_type === "form_submission")) {
          await requeueJobWithoutAttemptPenalty(job.id);
          continue;
        }
        await processJob(job);
        await finalizeJob(job.id, "done");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown job error";
        await finalizeJob(job.id, job.attempts >= 3 ? "failed" : "queued", message);
        logger.error({ jobId: job.id, error: message }, "Failed job, will retry if attempts remain");
      }
    }
  } finally {
    running = false;
  }
}

export function startSyncWorker(intervalMs = 200): void {
  if (timer) {
    return;
  }
  timer = setInterval(() => {
    void workerTick();
  }, intervalMs);
}
