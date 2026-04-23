import type { FC } from "react";
import { entityPlural } from "../../../shared/mapping-utils";
import { ds, shellCard } from "../../../shared/design-tokens";
import type { DashboardViewModel } from "../../../state";
import type { SyncDirection } from "../../../shared/types";

type Props = {
  vm: DashboardViewModel;
};

const directionButtonStyle = (active: boolean) => ({
  border: `1px solid ${active ? ds.blue : ds.blueLine}`,
  background: active ? ds.blue : ds.blueSoft,
  color: active ? "#FFFFFF" : ds.blue,
  borderRadius: ds.radius,
  padding: "5px 9px",
  cursor: "pointer",
});

export const MapTablesStep: FC<Props> = ({ vm }) => {
  const { hubspotEntityType, setDirectionForAllRows, syncDirection, wixEntityType } = vm;

  return (
    <div className="sync-grid sync-gap-12">
      <div
        style={{ ...shellCard, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center", padding: "22px 24px" }}
      >
        <div>
          <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>HubSpot</h3>
          <div style={{ fontSize: 13, color: "#55637D", marginBottom: 6 }}>Select {entityPlural(hubspotEntityType)}</div>
          <select value={entityPlural(hubspotEntityType)} onChange={() => {}} className="sync-input sync-pad-10">
            <option>{entityPlural(hubspotEntityType)}</option>
          </select>
        </div>

        <div className="sync-flex sync-items-center sync-justify-center sync-gap-6">
          {([
            { direction: "wix_to_hubspot", title: "HubSpot receives data from Wix", glyph: "←" },
            { direction: "bidirectional", title: "Sync bidirectionally", glyph: "↔" },
            { direction: "hubspot_to_wix", title: "Wix receives data from HubSpot", glyph: "→" },
          ] as const).map((item) => (
            <button
              key={item.direction}
              type="button"
              title={item.title}
              onClick={() => setDirectionForAllRows(item.direction as SyncDirection)}
              style={directionButtonStyle(syncDirection === item.direction)}
            >
              {item.glyph}
            </button>
          ))}
        </div>

        <div>
          <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Wix</h3>
          <div style={{ fontSize: 13, color: "#55637D", marginBottom: 6 }}>Select {entityPlural(wixEntityType)}</div>
          <select value={entityPlural(wixEntityType)} onChange={() => {}} className="sync-input sync-pad-10">
            <option>{entityPlural(wixEntityType)}</option>
          </select>
        </div>
      </div>
    </div>
  );
};
