import { entityPlural } from "../../../shared/mapping-utils";
import type { SyncDirection } from "../../../shared/types";
import { AppBadge } from "../../../shared/ui/app-badge";
import { getDirectionGlyph, humanLabelForKey } from "../utils/formatters";

type Accent = "blue" | "yellow";

type Props = {
  accent: Accent;
  topDirection: SyncDirection;
  rows: Array<{
    id: string | number;
    hubspotField: string;
    wixField: string;
    direction: SyncDirection;
  }>;
  subtitle: string;
  hubspotEntityType: string;
  wixEntityType: string;
};

export function MappingPreviewCard({
  accent,
  topDirection,
  rows,
  subtitle,
  hubspotEntityType,
  wixEntityType,
}: Props) {
  const directionChipClassName =
    accent === "yellow"
      ? "sync-details-direction-chip sync-details-direction-chip--yellow"
      : "sync-details-direction-chip";
  const compactDirectionChipClassName =
    accent === "yellow"
      ? "sync-details-direction-chip sync-details-direction-chip--compact sync-details-direction-chip--yellow"
      : "sync-details-direction-chip sync-details-direction-chip--compact";
  const items =
    rows.length > 0
      ? rows
      : [
          {
            id: "empty-preview",
            hubspotField: `No ${hubspotEntityType} fields mapped yet`,
            wixField: `No ${wixEntityType} fields mapped yet`,
            direction: topDirection,
          },
        ];

  return (
    <div className="sync-details-card sync-details-card--padded sync-stack-16">
      <div className="sync-details-map-grid">
        <div className="sync-details-info-tile sync-details-info-tile--inset">
          <AppBadge app="hubspot" badgeSize={28} logoSize={18} />
          <div className="sync-details-info-stack">
            <span className="sync-details-kicker">Table</span>
            <span className="sync-details-info-title">{entityPlural(hubspotEntityType)}</span>
          </div>
        </div>
        <div className={directionChipClassName}>{getDirectionGlyph(topDirection)}</div>
        <div className="sync-details-info-tile sync-details-info-tile--inset">
          <AppBadge app="wix" badgeSize={28} logoSize={18} />
          <div className="sync-details-info-stack">
            <span className="sync-details-kicker">Table</span>
            <span className="sync-details-info-title">{entityPlural(wixEntityType)}</span>
          </div>
        </div>
      </div>
      <div className="sync-details-copy">{subtitle}</div>
      <div className="sync-details-map-grid sync-details-map-grid--top">
        <div className="sync-details-column">
          <div className="sync-details-cell sync-details-cell--header">HubSpot</div>
          {items.map((row) => (
            <div key={`hs-${row.id}`} className="sync-details-cell">
              {humanLabelForKey(row.hubspotField)}
            </div>
          ))}
        </div>
        <div className="sync-details-column sync-details-column--direction">
          {items.map((row) => (
            <div key={`dir-${row.id}`} className={compactDirectionChipClassName}>
              {getDirectionGlyph(row.direction)}
            </div>
          ))}
        </div>
        <div className="sync-details-column">
          <div className="sync-details-cell sync-details-cell--header">Wix</div>
          {items.map((row) => (
            <div key={`wx-${row.id}`} className="sync-details-cell">
              {humanLabelForKey(row.wixField)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
