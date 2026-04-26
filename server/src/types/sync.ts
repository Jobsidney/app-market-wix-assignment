export type SyncSource = "wix" | "hubspot";

export interface SyncMapping {
  wixSiteId: string;
  wixContactId: string;
  hubspotContactId: string;
  lastSyncedAt: string;
  lastSyncSource: SyncSource;
  correlationId?: string | null;
}
