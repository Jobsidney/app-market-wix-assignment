import type { FC } from "react";
import { ds } from "../../shared/design-tokens";

export const HistoricalSyncView: FC = () => (
    <div style={{ minHeight: "calc(100vh - 56px)", background: ds.pageBg }}>
      <div style={{ display: "grid", placeItems: "center", padding: "48px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #FFE566, #EAB308)",
              boxShadow: "0 0 0 10px rgba(250, 204, 21, 0.22)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px dotted rgba(255,255,255,0.95)",
                borderTopColor: "transparent",
                animation: "histSpin 0.85s linear infinite",
              }}
            />
          </div>
          <div style={{ width: 220, height: 3, background: ds.line, borderRadius: 999, margin: "0 auto 22px" }} />
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700, color: ds.ink }}>Syncing historical data...</h2>
          <p style={{ margin: "0 0 28px", fontSize: 15, color: ds.muted, lineHeight: 1.55 }}>
            The data sync process may take several minutes to complete. We&apos;ll notify you via email once it&apos;s finished.
          </p>
          <div
            style={{
              background: ds.card,
              borderRadius: ds.radius,
              padding: "22px 24px 18px",
              boxShadow: "none",
              border: `1px solid ${ds.lineSoft}`,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8 }}>i</div>
            <div style={{ fontSize: 14, color: ds.muted, marginBottom: 8 }}>Do you know?</div>
            <div style={{ fontSize: 14, color: ds.text, lineHeight: 1.45 }}>
              You can use filters to fine-tune the sync data.{" "}
              <a href="https://dev.wix.com/docs" style={{ color: ds.blue, textDecoration: "none", fontWeight: 600 }}>
                Learn more ↗
              </a>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: i === 1 ? "#9CA3AF" : "#E5E7EB",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes histSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
);
