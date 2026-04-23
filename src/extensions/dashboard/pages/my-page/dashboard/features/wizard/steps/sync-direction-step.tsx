import type { FC } from "react";
import { ds, shellCard } from "../../../shared/design-tokens";
import { buildSyncName } from "../../../shared/sync-name-utils";
import type { DashboardViewModel } from "../../../state";
import type { SyncDirection } from "../../../shared/types";

type Props = {
  vm: DashboardViewModel;
};

export const SyncDirectionStep: FC<Props> = ({ vm }) => {
  const { existingRecordPolicy, hubspotEntityType, setDirectionForAllRows, setExistingRecordPolicy, syncDirection, wixEntityType } = vm;

  return (
    <div style={{ ...shellCard, display: "grid", gap: 14 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, color: ds.ink }}>Choose how your apps should stay in sync</h2>

      {([
        {
          id: "hubspot_to_wix",
          title: buildSyncName("hubspot_to_wix", hubspotEntityType, wixEntityType),
          subtitle: "All data will sync from HubSpot to Wix.",
        },
        {
          id: "wix_to_hubspot",
          title: buildSyncName("wix_to_hubspot", hubspotEntityType, wixEntityType),
          subtitle: "All data will sync from Wix to HubSpot.",
        },
        {
          id: "bidirectional",
          title: buildSyncName("bidirectional", hubspotEntityType, wixEntityType),
          subtitle: "Changes in either app will sync to the other.",
        },
      ] as const).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setDirectionForAllRows(option.id as SyncDirection)}
          style={{
            border: syncDirection === option.id ? `2px solid ${ds.blue}` : `1px solid ${ds.line}`,
            borderRadius: ds.radius,
            padding: "14px 16px",
            textAlign: "left",
            background: ds.card,
            cursor: "pointer",
            boxShadow: syncDirection === option.id ? "0 4px 14px rgba(0, 123, 255, 0.15)" : "none",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, color: ds.ink }}>{option.title}</div>
          <div style={{ fontSize: 13, color: ds.muted }}>{option.subtitle}</div>
        </button>
      ))}

      {syncDirection === "bidirectional" ? (
        <div style={{ borderTop: `1px solid ${ds.line}`, paddingTop: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 22, color: ds.ink }}>How should we sync existing records?</h3>
          <div className="sync-grid sync-gap-8">
            <button
              type="button"
              onClick={() => setExistingRecordPolicy("hubspot_to_wix")}
              style={{
                border: existingRecordPolicy === "hubspot_to_wix" ? `2px solid ${ds.blue}` : `1px solid ${ds.line}`,
                borderRadius: ds.radius,
                padding: "12px 14px",
                background: ds.card,
                textAlign: "left",
                boxShadow: existingRecordPolicy === "hubspot_to_wix" ? "0 4px 12px rgba(0, 123, 255, 0.12)" : "none",
              }}
            >
              {buildSyncName("hubspot_to_wix", hubspotEntityType, wixEntityType)}
            </button>
            <button
              type="button"
              onClick={() => setExistingRecordPolicy("wix_to_hubspot")}
              style={{
                border: existingRecordPolicy === "wix_to_hubspot" ? `2px solid ${ds.blue}` : `1px solid ${ds.line}`,
                borderRadius: ds.radius,
                padding: "12px 14px",
                background: ds.card,
                textAlign: "left",
                boxShadow: existingRecordPolicy === "wix_to_hubspot" ? "0 4px 12px rgba(0, 123, 255, 0.12)" : "none",
              }}
            >
              {buildSyncName("wix_to_hubspot", hubspotEntityType, wixEntityType)}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: ds.muted }}>After initial sync, future changes will sync both ways.</div>
        </div>
      ) : null}
    </div>
  );
};
