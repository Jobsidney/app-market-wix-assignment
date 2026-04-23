import { useState } from "react";
import { entityPlural } from "../../../shared/mapping-utils";
import type { SyncJob } from "../../../shared/types";
import { SyncFlowLabel } from "../../../shared/ui/sync-flow-label";
import { buildJobDetailLines, getJobRowActionLabel } from "../utils/formatters";

type DirectionStats = {
  wixToHubCreated: number;
  wixToHubUpdated: number;
  wixToHubDeleted: number;
  hubToWixCreated: number;
  hubToWixUpdated: number;
  hubToWixDeleted: number;
};

type Props = {
  historySearchId: string;
  historyDirectionFilter: "all" | "wix_to_hubspot" | "hubspot_to_wix";
  historyActionFilter: "all" | "create" | "update";
  historyStatusFilter: "all" | "done" | "failed" | "queued" | "processing";
  directionStats: DirectionStats;
  filteredHistoryJobs: SyncJob[];
  jobs: SyncJob[];
  wixEntityType: string;
  refreshSyncHistory: () => Promise<void>;
  setHistorySearchId: (value: string) => void;
  setHistoryDirectionFilter: (value: "all" | "wix_to_hubspot" | "hubspot_to_wix") => void;
  setHistoryActionFilter: (value: "all" | "create" | "update") => void;
  setHistoryStatusFilter: (value: "all" | "done" | "failed" | "queued" | "processing") => void;
  clearHistoryFilters: () => void;
};

export function SyncHistoryCard({
  historySearchId,
  historyDirectionFilter,
  historyActionFilter,
  historyStatusFilter,
  directionStats,
  filteredHistoryJobs,
  jobs,
  wixEntityType,
  refreshSyncHistory,
  setHistorySearchId,
  setHistoryDirectionFilter,
  setHistoryActionFilter,
  setHistoryStatusFilter,
  clearHistoryFilters,
}: Props) {
  const [expandedJobIds, setExpandedJobIds] = useState<number[]>([]);

  const toggleRowDetails = (jobId: number) => {
    setExpandedJobIds((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]));
  };

  return (
    <div className="sync-details-card sync-details-card--history sync-stack-20">
      <div className="sync-details-history-header">
        <h3 className="sync-card-title">Record change history detail</h3>
        <button type="button" onClick={() => void refreshSyncHistory()} className="sync-link-button">
          ↻ Refresh history
        </button>
      </div>

      <div className="sync-details-filter-grid">
        <label className="sync-details-filter-field">
          Search by record ID
          <input
            value={historySearchId}
            onChange={(e) => setHistorySearchId(e.target.value)}
            placeholder="Search by record ID"
            className="sync-input sync-input-sm"
          />
        </label>
        <label className="sync-details-filter-field">
          Records from
          <select className="sync-input sync-input-sm">
            <option>All time</option>
          </select>
        </label>
        <label className="sync-details-filter-field">
          Direction
          <select
            value={historyDirectionFilter}
            onChange={(e) => setHistoryDirectionFilter(e.target.value as "all" | "wix_to_hubspot" | "hubspot_to_wix")}
            className="sync-input sync-input-sm"
          >
            <option value="all">All</option>
            <option value="wix_to_hubspot">HubSpot ← Wix</option>
            <option value="hubspot_to_wix">HubSpot → Wix</option>
          </select>
        </label>
        <label className="sync-details-filter-field">
          Destination table
          <select className="sync-input sync-input-sm">
            <option>{entityPlural(wixEntityType)}</option>
          </select>
        </label>
        <label className="sync-details-filter-field">
          Action
          <select
            value={historyActionFilter}
            onChange={(e) => setHistoryActionFilter(e.target.value as "all" | "create" | "update")}
            className="sync-input sync-input-sm"
          >
            <option value="all">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
          </select>
        </label>
        <label className="sync-details-filter-field">
          Status
          <select
            value={historyStatusFilter}
            onChange={(e) => setHistoryStatusFilter(e.target.value as "all" | "done" | "failed" | "queued" | "processing")}
            className="sync-input sync-input-sm"
          >
            <option value="all">All</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
          </select>
        </label>
        <div className="sync-details-filter-actions">
          <button type="button" onClick={clearHistoryFilters} className="sync-link-button">
            Reset
          </button>
        </div>
      </div>

      <div className="sync-details-stats">
        <div className="sync-details-stats-column">
          <div className="sync-details-stats-topline">
            <SyncFlowLabel direction="wix_to_hubspot" showText={false} badgeSize={26.4} logoSize={16.94} />
            <div className="sync-details-stat-list">
              <span className="sync-details-stat">{directionStats.wixToHubCreated} Created</span>
              <span className="sync-details-stat">{directionStats.wixToHubUpdated} Updated</span>
              <span className="sync-details-stat">{directionStats.wixToHubDeleted} Deleted</span>
            </div>
          </div>
          <div className="sync-details-stats-note">Changes updated realtime</div>
        </div>
        <div className="sync-details-stats-column sync-details-stats-column--split">
          <div className="sync-details-stats-topline">
            <SyncFlowLabel direction="hubspot_to_wix" showText={false} badgeSize={26.4} logoSize={16.94} />
            <div className="sync-details-stat-list">
              <span className="sync-details-stat">{directionStats.hubToWixCreated} Created</span>
              <span className="sync-details-stat">{directionStats.hubToWixUpdated} Updated</span>
              <span className="sync-details-stat">{directionStats.hubToWixDeleted} Deleted</span>
            </div>
          </div>
          <div className="sync-details-stats-note">Changes delayed up to 5 mins</div>
        </div>
      </div>

      <div className="sync-details-table-scroll">
        <div className="sync-details-table">
          <div className="sync-details-table-head">
            <span />
            <span>Direction</span>
            <span>Destination table</span>
            <span>Action</span>
            <span>Status</span>
            <span>Timestamp</span>
          </div>
          <div className="sync-details-table-body">
            {filteredHistoryJobs.length === 0 ? (
              <div className="sync-details-table-empty">
                {jobs.length > 0 ? (
                  <>
                    No rows match your filters.{" "}
                    <button type="button" onClick={clearHistoryFilters} className="sync-link-button">
                      Clear filters
                    </button>
                  </>
                ) : (
                  "No rows yet. Start sync and refresh history."
                )}
              </div>
            ) : (
              filteredHistoryJobs.map((job, rowIdx) => {
                const hubToWix = job.event_source === "hubspot";
                const last = rowIdx === filteredHistoryJobs.length - 1;
                const expanded = expandedJobIds.includes(job.id);
                const details = buildJobDetailLines(job);

                return (
                  <div key={job.id} className={`sync-details-table-row${last ? " sync-details-table-row--last" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleRowDetails(job.id)}
                      className="sync-details-expander"
                      aria-label={expanded ? "Collapse details" : "Expand details"}
                    >
                      {expanded ? "▾" : "▸"}
                    </button>
                    <SyncFlowLabel direction={hubToWix ? "hubspot_to_wix" : "wix_to_hubspot"} showText={false} />
                    <span>{entityPlural(wixEntityType)}</span>
                    <span>{getJobRowActionLabel(job)}</span>
                    <span>
                      {job.status === "done" ? (
                        <span className="sync-status-ok">✓</span>
                      ) : job.status === "failed" ? (
                        <span className="sync-status-fail">✕</span>
                      ) : (
                        <span className="sync-status-pending">…</span>
                      )}
                    </span>
                    <span className="sync-timestamp">
                      {new Date(job.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {expanded ? (
                      <div className="sync-details-row-details">
                        {details.map((line, idx) => (
                          <div key={`${job.id}-${idx}`} className="sync-details-row-detail-line">
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
