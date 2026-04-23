import type { FC } from "react";
import { ds, shellCard } from "../../../shared/design-tokens";
import type { DataSyncOption } from "../../../shared/types";
import type { DashboardViewModel } from "../../../state";

type Props = {
  vm: DashboardViewModel;
};

const OPTIONS: Array<{ id: DataSyncOption; title: string; description: string }> = [
  {
    id: "existing_and_future",
    title: "Existing Data and Future Changes",
    description: "Import existing data and continuously sync new records.",
  },
  {
    id: "existing_only",
    title: "Existing Data Only",
    description: "One-time import of existing data with no future updates.",
  },
  {
    id: "future_only",
    title: "Future Changes Only",
    description: "Monitor changes from this point forward only.",
  },
];

export const SyncDataOptionsStep: FC<Props> = ({ vm }) => {
  const { setSyncOption, syncOption } = vm;

  return (
    <div style={{ ...shellCard, display: "grid", placeItems: "center", gap: 12, padding: 26 }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: ds.ink }}>Select Which Data To Sync</h2>
      {OPTIONS.map((item) => {
        const selected = syncOption === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setSyncOption(item.id)}
            style={{
              width: 360,
              border: selected ? `2px solid ${ds.blue}` : `1px solid ${ds.line}`,
              borderRadius: ds.radius,
              padding: 18,
              background: ds.card,
              textAlign: "center",
              cursor: "pointer",
              boxShadow: selected ? "0 4px 14px rgba(0, 123, 255, 0.2)" : "none",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: selected ? ds.blue : ds.ink }}>{item.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: ds.muted }}>{item.description}</div>
          </button>
        );
      })}
    </div>
  );
};
