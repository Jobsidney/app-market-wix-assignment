export type SyncSource = "wix" | "hubspot";

export interface SyncMapping {
  wixContactId: string;
  hubspotContactId: string;
  lastSyncedAt: string;
  lastSyncSource: SyncSource;
  correlationId?: string | null;
}
