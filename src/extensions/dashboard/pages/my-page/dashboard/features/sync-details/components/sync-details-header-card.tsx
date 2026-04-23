import type { SyncDirection } from "../../../shared/types";
import { SyncFlowLabel } from "../../../shared/ui/sync-flow-label";

type Props = {
  syncName: string | null | undefined;
  syncDirection: SyncDirection;
  hubspotEntityType: string;
  wixEntityType: string;
  detailsManagedRecordsCount: number;
  liveEnabled: boolean;
  isTogglingLive: boolean;
  onBack: () => void;
  onToggleLive: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function SyncDetailsHeaderCard({
  syncName,
  syncDirection,
  hubspotEntityType,
  wixEntityType,
  detailsManagedRecordsCount,
  liveEnabled,
  isTogglingLive,
  onBack,
  onToggleLive,
  onEdit,
  onDelete,
}: Props) {
  const liveStateClassName = liveEnabled ? " sync-details-toggle-dot--active" : "";
  const liveLabelClassName = liveEnabled ? " sync-details-toggle-label--active" : "";
  const toggleClassName = liveEnabled ? " sync-details-toggle--active" : "";

  return (
    <>
      <div className="sync-details-topbar">
        <div className="sync-details-breadcrumbs">
          <div className="sync-details-breadcrumb">
            Sync Dashboard / <span className="sync-details-breadcrumb-current">Sync details</span>
          </div>
        </div>
        <button type="button" onClick={onBack} className="sync-link-button sync-ml-auto">
          ← Back to dashboard
        </button>
      </div>

      <div className="sync-details-card sync-details-card--header sync-stack-18">
        <div className="sync-details-header-main">
          <div className="sync-flex sync-items-center sync-gap-10 sync-wrap sync-min-w-0">
            <SyncFlowLabel
              direction={syncDirection}
              hubspotEntity={hubspotEntityType}
              wixEntity={wixEntityType}
              savedName={syncName}
              badgeSize={24}
              logoSize={15}
              textSize={16}
              secondaryTextSize={12}
            />
            <span className="sync-muted-icon">✎</span>
          </div>
          <div className="sync-details-header-actions">
            <button type="button" className="sync-link-button">
              Check Wix Changes
            </button>
            <div className="sync-details-toggle-group">
              <span className={`sync-details-toggle-dot${liveStateClassName}`} aria-hidden />
              <span className={`sync-details-toggle-label${liveLabelClassName}`}>
                {liveEnabled ? "Live" : "Start Sync"}
              </span>
              <button
                type="button"
                disabled={isTogglingLive}
                onClick={onToggleLive}
                className={`sync-details-toggle${toggleClassName}`}
              >
                <span className="sync-details-toggle-thumb" />
              </button>
            </div>
            <button type="button" onClick={onEdit} className="sync-btn-secondary sync-details-action-button">
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="sync-icon-button sync-icon-button-danger"
              aria-label="Delete sync"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="sync-details-managed-records">
          MANAGED RECORDS: <strong>{detailsManagedRecordsCount}</strong>
        </div>
      </div>
    </>
  );
}
