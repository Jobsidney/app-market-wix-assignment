import type { FC } from "react";
import { AppBadge } from "./app-badge";
import { buildSyncAppsLabel, buildSyncName, getSyncDirectionArrow } from "../sync-name-utils";
import type { SyncDirection } from "../types";

type Props = {
  direction: SyncDirection;
  hubspotEntity?: string;
  wixEntity?: string;
  savedName?: string | null;
  showText?: boolean;
  showDirectionArrow?: boolean;
  badgeSize?: number;
  logoSize?: number;
  textSize?: number;
  secondaryTextSize?: number;
};

export const SyncFlowLabel: FC<Props> = ({
  direction,
  hubspotEntity,
  wixEntity,
  savedName,
  showText = true,
  showDirectionArrow = true,
  badgeSize = 24,
  logoSize = 15,
  textSize = 14,
  secondaryTextSize = 12,
}) => {
  const primaryLabel =
    hubspotEntity && wixEntity ? buildSyncName(direction, hubspotEntity, wixEntity) : buildSyncAppsLabel(direction);
  const normalizedSavedName = savedName?.trim();
  const showSavedName = Boolean(normalizedSavedName && normalizedSavedName.toLowerCase() !== primaryLabel.trim().toLowerCase());

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <AppBadge app="hubspot" badgeSize={badgeSize} logoSize={logoSize} />
        {showDirectionArrow ? (
          <span style={{ fontSize: Math.max(14, logoSize + 2), fontWeight: 700, color: "#64748B", lineHeight: 1 }}>
            {getSyncDirectionArrow(direction)}
          </span>
        ) : null}
        <AppBadge app="wix" badgeSize={badgeSize} logoSize={logoSize} />
      </div>
      {showText ? (
        <div style={{ display: "grid", gap: showSavedName ? 2 : 0, minWidth: 0 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 700,
              color: "#1E293B",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {primaryLabel}
          </span>
          {showSavedName ? (
            <span
              style={{
                fontSize: secondaryTextSize,
                color: "#64748B",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {normalizedSavedName}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
