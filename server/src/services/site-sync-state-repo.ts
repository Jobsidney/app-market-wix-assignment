import { db } from "../lib/db.js";

export async function getSiteSyncLiveEnabled(wixSiteId: string): Promise<boolean> {
  const result = await db.query<{ live: boolean }>("select live from site_sync_state where wix_site_id = $1", [wixSiteId]);
  if (!result.rows[0]) {
    return true;
  }
  return result.rows[0].live;
}

export async function setSiteSyncLiveEnabled(wixSiteId: string, live: boolean): Promise<void> {
  await db.query(
    `insert into site_sync_state (wix_site_id, live)
     values ($1, $2)
     on conflict (wix_site_id)
     do update set live = excluded.live, updated_at = now()`,
    [wixSiteId, live],
  );
}
