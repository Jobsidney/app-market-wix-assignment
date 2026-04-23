import type { FC } from "react";
import { ds, shellCard } from "../../../shared/design-tokens";
import type { DashboardViewModel } from "../../../state";

type Props = {
  vm: DashboardViewModel;
};

const REVIEW_ITEMS = [
  "App connection fields",
  "Map tables",
  "Select Sync option",
  "Map fields",
  "Sync Existing data",
  "Final review of what will happen before your sync goes live",
] as const;

export const ReviewStep: FC<Props> = ({ vm }) => {
  const { hubspotEntityType, jobs, previewPhase, wixEntityType } = vm;

  return (
    <div style={{ ...shellCard, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 28, color: ds.ink }}>Sync Progress and Review</h3>
      <div style={{ fontSize: 13, color: ds.muted }}>
        Objects: HubSpot {hubspotEntityType} ↔ Wix {wixEntityType}. The running integration only processes Contact ↔ Contact; other
        types are UI-only until their APIs are added.
      </div>

      {previewPhase === "generating" ? (
        <div style={{ display: "grid", placeItems: "center", gap: 12, padding: "26px 12px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              border: "4px solid #FFE08A",
              borderTopColor: "#FFFFFF",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <div style={{ width: 220, height: 6, background: "#E8EDF8", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: "45%", height: "100%", background: ds.blue, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 14, color: ds.muted }}>Generating preview...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : null}

      {previewPhase === "ready" ? (
        <div className="sync-grid sync-gap-6">
          {REVIEW_ITEMS.map((title, index) => (
            <div
              key={title}
              style={{
                border: `1px solid ${ds.greenBorder}`,
                borderRadius: ds.radius,
                padding: "10px 12px",
                background: ds.greenBg,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "none",
              }}
            >
              <span style={{ fontWeight: 700, color: ds.greenInk }}>
                {index + 1}. {title}
              </span>
              <span style={{ color: ds.greenInk, fontWeight: 800 }}>✓</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: 6, borderTop: `1px solid ${ds.line}`, paddingTop: 10 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 17, color: ds.ink }}>Record change history detail</h4>
        {jobs.length === 0 ? (
          <div style={{ fontSize: 13, color: ds.muted }}>No sync history yet.</div>
        ) : (
          <div className="sync-grid sync-gap-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  ...shellCard,
                  padding: "8px 10px",
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 90px 120px",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span>#{job.id}</span>
                <span>{job.job_type}</span>
                <span>{job.status}</span>
                <span>{new Date(job.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
