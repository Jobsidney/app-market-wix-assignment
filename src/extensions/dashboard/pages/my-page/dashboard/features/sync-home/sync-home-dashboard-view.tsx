import type { FC } from "react";
import type { DashboardViewModel } from "../../state";
import { ds, shellCard } from "../../shared/design-tokens";
import { SyncFlowLabel } from "../../shared/ui/sync-flow-label";

type Props = { vm: DashboardViewModel };

export const SyncHomeDashboardView: FC<Props> = ({ vm }) => {
  const { syncHomeRows, startCreateSyncFlow, openSyncDetails, managedRecordsCount } = vm;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.34fr)",
        gap: 28,
        alignItems: "start",
      }}
    >
      <section style={{ ...shellCard, padding: "24px 28px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 0, gap: 16 }}>
          <h2 className="sync-card-title">Data Sync</h2>
          <button
            type="button"
            className="sync-btn-primary"
            onClick={startCreateSyncFlow}
            style={{ padding: "7px 14px", fontWeight: 700 }}
          >
            Create sync
          </button>
        </div>
        <div style={{ marginTop: 20, borderTop: `1px solid ${ds.nestBorder}` }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 0.9fr 0.8fr 1.2fr",
              gap: 8,
              padding: "12px 0",
              fontSize: 12,
              fontWeight: 600,
              color: "#64748B",
              letterSpacing: "0.02em",
              borderBottom: `1px solid ${ds.hair}`,
              background: ds.surfaceInset,
            }}
          >
            <span>Sync name</span>
            <span>Last activity</span>
            <span>Status</span>
            <span>Sync type</span>
          </div>
          {syncHomeRows.length === 0 ? (
            <div style={{ padding: "20px 0", color: ds.muted, fontSize: 13 }}>
              No syncs created yet. Click <strong>Create sync</strong> to start.
            </div>
          ) : (
            syncHomeRows.map((row, idx) => (
              <button
                key={row.key}
                type="button"
                onClick={() => void openSyncDetails(row.name, row.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 0.9fr 0.8fr 1.2fr",
                  gap: 8,
                  padding: "14px 0",
                  borderBottom: idx === syncHomeRows.length - 1 ? "none" : `1px solid ${ds.hair}`,
                  fontSize: 13,
                  alignItems: "center",
                  textAlign: "left",
                  width: "100%",
                  borderLeft: "none",
                  borderRight: "none",
                  borderTop: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <SyncFlowLabel
                    direction={row.syncDirection}
                    hubspotEntity={row.hubspotEntity}
                    wixEntity={row.wixEntity}
                    savedName={row.name}
                    showDirectionArrow={false}
                    badgeSize={24}
                    logoSize={15}
                    textSize={13}
                    secondaryTextSize={11}
                  />
                </span>
                <span>{row.lastActivity}</span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      background: row.status === "Live" ? "#10B981" : row.status === "Paused" ? "#F59E0B" : "#38BDF8",
                    }}
                  >
                    {row.status}
                  </span>
                </span>
                <span>{row.syncType}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <aside style={{ ...shellCard, padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, gap: 12 }}>
          <span className="sync-card-title">SyncFree</span>
          <span style={{ color: ds.muted, fontSize: 12 }}>All Records</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{managedRecordsCount}</div>
        <div style={{ color: ds.muted, fontSize: 13, marginBottom: 10 }}>records used</div>
        <div style={{ height: 4, background: "#E5E7EB", borderRadius: 999 }}>
          <div style={{ width: `${Math.min(100, managedRecordsCount * 10)}%`, height: "100%", background: ds.blue, borderRadius: 999 }} />
        </div>
      </aside>
    </div>
  );
};
