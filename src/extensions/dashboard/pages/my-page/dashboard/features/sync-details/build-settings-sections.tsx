import { entityPlural } from "../../shared/mapping-utils";
import { getSyncDirectionArrow } from "../../shared/sync-name-utils";
import type { ViewSettingsSection } from "../../shared/types";
import { MappingPreviewCard } from "./components/mapping-preview-card";
import type { SyncSettingsSectionConfig } from "./components/sync-settings-card";
import type { PreviewMappingRow } from "./utils/formatters";

type BuildSyncSettingsSectionsParams = {
  hubspotEntityType: string;
  wixEntityType: string;
  syncDirection: "hubspot_to_wix" | "wix_to_hubspot" | "bidirectional";
  existingRecordPolicy: "hubspot_to_wix" | "wix_to_hubspot";
  syncOptionLabel: string;
  realtimeMappings: PreviewMappingRow[];
  existingMappings: PreviewMappingRow[];
};

type StaticSection = {
  id: ViewSettingsSection;
  title: string;
};

const staticSections: StaticSection[] = [
  { id: "connect_apps", title: "App connections fields" },
  { id: "map_tables", title: "Map tables" },
  { id: "sync_data_options", title: "Select Sync option" },
  { id: "map_fields", title: "Map fields (Real-time Sync)" },
  { id: "review", title: "Sync Existing data" },
];

export function buildSyncSettingsSections({
  hubspotEntityType,
  wixEntityType,
  syncDirection,
  existingRecordPolicy,
  syncOptionLabel,
  realtimeMappings,
  existingMappings,
}: BuildSyncSettingsSectionsParams): SyncSettingsSectionConfig[] {
  return staticSections.map((section) => ({
    id: section.id,
    title: section.title,
    content: renderSectionContent(section.id, {
      hubspotEntityType,
      wixEntityType,
      syncDirection,
      existingRecordPolicy,
      syncOptionLabel,
      realtimeMappings,
      existingMappings,
    }),
  }));
}

function renderSectionContent(
  sectionId: ViewSettingsSection,
  {
    hubspotEntityType,
    wixEntityType,
    syncDirection,
    existingRecordPolicy,
    syncOptionLabel,
    realtimeMappings,
    existingMappings,
  }: BuildSyncSettingsSectionsParams,
) {
  if (sectionId === "connect_apps") {
    return (
      <div className="sync-details-card sync-details-card--padded sync-details-panel">
        <div className="sync-details-two-col">
          {[
            { label: "HubSpot", connected: true },
            { label: "Wix", connected: true },
          ].map((item) => (
            <div key={item.label} className="sync-details-info-tile sync-details-info-tile--connection">
              <span className="sync-details-info-title">{item.label}</span>
              <span className="sync-details-pill sync-details-pill--connected">
                {item.connected ? "Connected" : "Not connected"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sectionId === "map_tables") {
    return (
      <div className="sync-details-card sync-details-card--padded sync-details-panel">
        <div className="sync-details-map-grid">
          <div className="sync-details-info-tile">
            <div className="sync-details-info-title sync-mb-12">HubSpot</div>
            <div className="sync-details-info-value">{entityPlural(hubspotEntityType)}</div>
          </div>
          <div className="sync-details-direction-chip sync-details-direction-chip--no-border">
            {getSyncDirectionArrow(syncDirection)}
          </div>
          <div className="sync-details-info-tile">
            <div className="sync-details-info-title sync-mb-12">Wix</div>
            <div className="sync-details-info-value">{entityPlural(wixEntityType)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (sectionId === "sync_data_options") {
    return (
      <div className="sync-details-card sync-details-card--padded sync-details-panel">
        <div className="sync-details-body-copy">
          Sync transactions: HubSpot {getSyncDirectionArrow(syncDirection)} Wix | {syncOptionLabel}
        </div>
      </div>
    );
  }

  if (sectionId === "map_fields") {
    return (
      <MappingPreviewCard
        accent="blue"
        topDirection={syncDirection}
        rows={realtimeMappings}
        subtitle={
          syncDirection === "hubspot_to_wix"
            ? "Future HubSpot changes sync to Wix in real time."
            : syncDirection === "wix_to_hubspot"
              ? "Future Wix changes sync to HubSpot in real time."
              : "Future changes sync both ways in real time using the field directions below."
        }
        hubspotEntityType={hubspotEntityType}
        wixEntityType={wixEntityType}
      />
    );
  }

  return (
    <MappingPreviewCard
      accent="yellow"
      topDirection={existingRecordPolicy}
      rows={existingMappings}
      subtitle={
        existingRecordPolicy === "hubspot_to_wix"
          ? "Existing records will sync from HubSpot to Wix first before real-time sync continues."
          : "Existing records will sync from Wix to HubSpot first before real-time sync continues."
      }
      hubspotEntityType={hubspotEntityType}
      wixEntityType={wixEntityType}
    />
  );
}
