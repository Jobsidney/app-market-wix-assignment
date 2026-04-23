export type SyncDirection = "hubspot_to_wix" | "wix_to_hubspot" | "bidirectional";
export type DataSyncOption = "existing_and_future" | "existing_only" | "future_only";
export type ExistingRecordPolicy = "hubspot_to_wix" | "wix_to_hubspot";
export type WizardStep = "connect_apps" | "map_tables" | "sync_data_options" | "sync_direction" | "map_fields" | "review";

export type MappingRow = {
  id: string | number;
  wixField: string;
  hubspotField: string;
  syncDirection: "wix_to_hubspot" | "hubspot_to_wix" | "bidirectional";
  transformRule: string;
};

export type HubspotPropertyOption = { name: string; label: string };

export type SyncJob = {
  id: number;
  job_type: string;
  status: string;
  attempts: number;
  created_at: string;
  event_source?: string;
  payload?: Record<string, unknown>;
  last_error?: string | null;
};

export type SyncHomeRow = {
  key: string | number;
  id?: number;
  name: string;
  lastActivity: string;
  status: string;
  syncType: string;
  syncDirection: SyncDirection;
  hubspotEntity: string;
  wixEntity: string;
};

export type SyncDefinition = {
  id: number;
  name: string;
  hubspotEntity: string;
  wixEntity: string;
  syncOption: string;
  syncDirection: string;
  existingRecordPolicy: string;
  live: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ViewSettingsSection = "connect_apps" | "map_tables" | "sync_data_options" | "map_fields" | "review";
