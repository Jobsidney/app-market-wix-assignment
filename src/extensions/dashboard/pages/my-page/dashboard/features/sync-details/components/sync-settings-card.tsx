import { useState } from "react";
import type { ReactNode } from "react";
import type { ViewSettingsSection } from "../../../shared/types";
import { SyncSettingsSection } from "./sync-settings-section";

export type SyncSettingsSectionConfig = {
  id: ViewSettingsSection;
  title: string;
  content: ReactNode;
};

type Props = {
  syncOptionLabel: string;
  sections: SyncSettingsSectionConfig[];
  onEditSection: (section: ViewSettingsSection) => void;
};

export function SyncSettingsCard({ syncOptionLabel, sections, onEditSection }: Props) {
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ViewSettingsSection | null>(null);

  const toggleSettingsPanel = () => {
    const nextOpen = !showSettingsPanel;
    setShowSettingsPanel(nextOpen);
    setExpandedSection(null);
  };

  return (
    <div className={`sync-details-card sync-details-card--padded${showSettingsPanel ? " sync-stack-16" : ""}`}>
      <div className="sync-details-settings-header">
        <button type="button" onClick={toggleSettingsPanel} className="sync-link-button">
          View Sync Settings
        </button>
        <div className="sync-details-settings-summary">
          <span className="sync-details-summary-label">Sync option</span>
          <button type="button" onClick={toggleSettingsPanel} className="sync-details-summary-pill">
            {syncOptionLabel}
            <span className="sync-details-summary-pill-icon">{showSettingsPanel ? "▴" : "▾"}</span>
          </button>
        </div>
      </div>
      {showSettingsPanel ? (
        <div className="sync-details-settings-panel">
          {sections.map((section, index) => {
            const expanded = expandedSection === section.id;
            return (
              <SyncSettingsSection
                key={section.id}
                index={index + 1}
                title={section.title}
                expanded={expanded}
                onToggle={() => setExpandedSection(expanded ? null : section.id)}
                onEdit={() => onEditSection(section.id)}
              >
                {section.content}
              </SyncSettingsSection>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
