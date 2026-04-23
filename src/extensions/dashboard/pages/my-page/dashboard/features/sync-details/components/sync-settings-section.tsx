import type { ReactNode } from "react";

type Props = {
  index: number;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  children: ReactNode;
};

export function SyncSettingsSection({ index, title, expanded, onToggle, onEdit, children }: Props) {
  return (
    <div className="sync-details-section">
      <button type="button" onClick={onToggle} className="sync-details-section-toggle">
        <span>
          {index} {title}
        </span>
        <span>{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded ? (
        <div className="sync-details-section-content">
          {children}
          <div className="sync-details-section-actions">
            <button type="button" onClick={onEdit} className="sync-btn-primary sync-btn-compact">
              Edit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
