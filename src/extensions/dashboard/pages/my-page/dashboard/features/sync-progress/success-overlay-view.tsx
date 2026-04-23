import type { FC } from "react";
import type { DashboardViewModel } from "../../state";
import { ds } from "../../shared/design-tokens";

type Props = { vm: DashboardViewModel };

export const SuccessOverlayView: FC<Props> = ({ vm }) => {
  const { setPostWizardPhase } = vm;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "grid",
        placeItems: "center",
        background: "rgba(15,23,42,0.42)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(420px, 92vw)",
          background: ds.card,
          borderRadius: ds.radius,
          padding: "36px 28px 32px",
          boxShadow: ds.shadowModal,
          border: `1px solid ${ds.line}`,
          textAlign: "center",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setPostWizardPhase("summary")}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            color: "#374151",
          }}
        >
          ×
        </button>
        <h2 style={{ margin: "0 0 22px", fontSize: 26, fontWeight: 800, color: ds.blue }}>Your sync is now live!</h2>
        <button
          type="button"
          onClick={() => setPostWizardPhase("summary")}
          style={{
            border: "none",
            borderRadius: ds.radius,
            padding: "12px 28px",
            background: ds.blue,
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Go to sync summary
        </button>
      </div>
    </div>
  );
};
