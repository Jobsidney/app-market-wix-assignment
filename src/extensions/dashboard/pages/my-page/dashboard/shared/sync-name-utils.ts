import type { SyncDirection } from "./types";

export function getSyncDirectionArrow(direction: SyncDirection): "→" | "←" | "↔" {
  if (direction === "hubspot_to_wix") {
    return "→";
  }
  if (direction === "wix_to_hubspot") {
    return "←";
  }
  return "↔";
}

export function buildSyncAppsLabel(direction: SyncDirection): string {
  return `HubSpot ${getSyncDirectionArrow(direction)} Wix`;
}

export function buildSyncName(direction: SyncDirection, hubspotEntity: string, wixEntity: string): string {
  return `HubSpot ${hubspotEntity} ${getSyncDirectionArrow(direction)} Wix ${wixEntity}`;
}
