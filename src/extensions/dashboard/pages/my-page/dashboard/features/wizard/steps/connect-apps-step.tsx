import type { FC } from "react";
import { ds, shellCard } from "../../../shared/design-tokens";
import { SYNC_DATA_TYPES } from "../../../shared/constants";
import type { DashboardViewModel } from "../../../state";
import { HubSpotFormEmbedCard } from "../components/hubspot-form-embed-card";

type Props = {
  vm: DashboardViewModel;
};

export const ConnectAppsStep: FC<Props> = ({ vm }) => {
  const { connected, handleConnectToggle, hubspotEntityType, isTogglingConnection, setHubspotEntityType, setWixEntityType, wixEntityType } =
    vm;

  return (
    <div className="sync-grid sync-gap-12">
      <div className="sync-grid sync-two-cols" style={{ gap: 24 }}>
        <div className="sync-card sync-connect-card" style={shellCard}>
          <h3 className="sync-h3">Select your first app</h3>
          <input className="sync-input" value="HubSpot" readOnly />
          <span className="sync-badge-connected">{connected ? "Connected" : "Not connected"}</span>
          <div className="sync-label">
            What data type do you want to sync? <span className="sync-asterisk">*</span>
          </div>
          <select className="sync-input" value={hubspotEntityType} onChange={(event) => setHubspotEntityType(event.target.value)}>
            {SYNC_DATA_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="sync-btn-primary"
            type="button"
            onClick={handleConnectToggle}
            disabled={isTogglingConnection}
            style={{ border: `1px solid ${ds.blue}`, padding: "8px 12px", background: ds.blue, color: "#FFFFFF", fontWeight: 600 }}
          >
            {isTogglingConnection ? "Updating..." : connected ? "Disconnect HubSpot" : "Connect HubSpot"}
          </button>
        </div>

        <div className="sync-card sync-connect-card" style={shellCard}>
          <h3 className="sync-h3">Select your second app</h3>
          <input className="sync-input" value="Wix" readOnly />
          <span className="sync-badge-connected">Connected</span>
          <div className="sync-label">
            What data type do you want to sync? <span className="sync-asterisk">*</span>
          </div>
          <select className="sync-input" value={wixEntityType} onChange={(event) => setWixEntityType(event.target.value)}>
            {SYNC_DATA_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <HubSpotFormEmbedCard />
    </div>
  );
};
