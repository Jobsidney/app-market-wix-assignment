import { useMemo, useState } from "react";
import type { FC } from "react";
import type { DashboardViewModel } from "../../state";
import type { ViewSettingsSection } from "../../shared/types";
import { buildSyncSettingsSections } from "./build-settings-sections";
import { ConfirmDialog } from "./components/confirm-dialog";
import { StartSyncDialog } from "./components/start-sync-dialog";
import { SyncDetailsHeaderCard } from "./components/sync-details-header-card";
import { SyncHistoryCard } from "./components/sync-history-card";
import { SyncSettingsCard } from "./components/sync-settings-card";
import type { PreviewMappingRow } from "./utils/formatters";

type Props = { vm: DashboardViewModel };

export const SyncDetailsDashboardView: FC<Props> = ({ vm }) => {
  const {
    openSyncHome,
    selectedSyncName,
    selectedSync,
    hubspotEntityType,
    wixEntityType,
    liveEnabled,
    isTogglingLive,
    patchSyncLive,
    openEditSyncFlow,
    openEditSyncStep,
    startSyncImmediatelyFromDetails,
    deleteCurrentSync,
    refreshSyncHistory,
    syncOptionLabel,
    detailsManagedRecordsCount,
    mappings,
    syncDirection,
    existingRecordPolicy,
    historySearchId,
    setHistorySearchId,
    historyDirectionFilter,
    setHistoryDirectionFilter,
    historyActionFilter,
    setHistoryActionFilter,
    historyStatusFilter,
    setHistoryStatusFilter,
    clearHistoryFilters,
    directionStats,
    filteredHistoryJobs,
    jobs,
  } = vm;

  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStartSyncModal, setShowStartSyncModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingEditStep, setPendingEditStep] = useState<ViewSettingsSection | null>(null);

  const handleEditRequest = (targetStep?: ViewSettingsSection) => {
    setPendingEditStep(targetStep ?? null);
    if (liveEnabled) {
      setShowEditConfirm(true);
      return;
    }
    if (targetStep) {
      openEditSyncStep(targetStep);
      return;
    }
    openEditSyncFlow();
  };

  const configuredMappings = useMemo(
    () => mappings.filter((row) => row.hubspotField.trim().length > 0 && row.wixField.trim().length > 0),
    [mappings],
  );
  const previewMappings = configuredMappings.slice(0, 6);

  const realtimeMappings: PreviewMappingRow[] = previewMappings.map((row) => ({
    id: row.id,
    hubspotField: row.hubspotField,
    wixField: row.wixField,
    direction: syncDirection === "bidirectional" ? row.syncDirection : syncDirection,
  }));

  const existingMappings: PreviewMappingRow[] = previewMappings.map((row) => ({
    id: row.id,
    hubspotField: row.hubspotField,
    wixField: row.wixField,
    direction: existingRecordPolicy,
  }));

  const settingsSections = useMemo(
    () =>
      buildSyncSettingsSections({
        hubspotEntityType,
        wixEntityType,
        syncDirection,
        existingRecordPolicy,
        syncOptionLabel,
        realtimeMappings,
        existingMappings,
      }),
    [
      existingMappings,
      existingRecordPolicy,
      hubspotEntityType,
      realtimeMappings,
      syncDirection,
      syncOptionLabel,
      wixEntityType,
    ],
  );

  const handleConfirmEdit = () => {
    void (async () => {
      await patchSyncLive(false);
      setShowEditConfirm(false);
      if (pendingEditStep) {
        openEditSyncStep(pendingEditStep);
      } else {
        openEditSyncFlow();
      }
      setPendingEditStep(null);
    })();
  };

  const handleCloseEditConfirm = () => {
    setPendingEditStep(null);
    setShowEditConfirm(false);
  };

  const handleDeleteConfirm = () => {
    void (async () => {
      setIsDeleting(true);
      try {
        await deleteCurrentSync();
        setShowDeleteConfirm(false);
      } finally {
        setIsDeleting(false);
      }
    })();
  };

  const handlePreviewFirst = () => {
    setShowStartSyncModal(false);
    openEditSyncFlow();
    clearHistoryFilters();
  };

  const handleStartImmediately = () => {
    setShowStartSyncModal(false);
    void startSyncImmediatelyFromDetails();
  };

  return (
    <div className="sync-details-page">
      <div className="sync-details-shell">
        <div className="sync-details-shell-inner sync-stack-24">
          <SyncDetailsHeaderCard
            syncName={selectedSync?.name ?? selectedSyncName}
            syncDirection={syncDirection}
            hubspotEntityType={hubspotEntityType}
            wixEntityType={wixEntityType}
            detailsManagedRecordsCount={detailsManagedRecordsCount}
            liveEnabled={liveEnabled}
            isTogglingLive={isTogglingLive}
            onBack={() => {
              void openSyncHome();
            }}
            onToggleLive={() => {
              if (liveEnabled) {
                void patchSyncLive(false);
                return;
              }
              setShowStartSyncModal(true);
            }}
            onEdit={() => handleEditRequest()}
            onDelete={() => setShowDeleteConfirm(true)}
          />

          <SyncSettingsCard
            syncOptionLabel={syncOptionLabel}
            sections={settingsSections}
            onEditSection={(section) => handleEditRequest(section)}
          />

          <SyncHistoryCard
            historySearchId={historySearchId}
            historyDirectionFilter={historyDirectionFilter}
            historyActionFilter={historyActionFilter}
            historyStatusFilter={historyStatusFilter}
            directionStats={directionStats}
            filteredHistoryJobs={filteredHistoryJobs}
            jobs={jobs}
            wixEntityType={wixEntityType}
            refreshSyncHistory={refreshSyncHistory}
            setHistorySearchId={setHistorySearchId}
            setHistoryDirectionFilter={setHistoryDirectionFilter}
            setHistoryActionFilter={setHistoryActionFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            clearHistoryFilters={clearHistoryFilters}
          />
        </div>
      </div>

      {showEditConfirm ? (
        <ConfirmDialog
          tone="info"
          title="Info!"
          message="You need to stop the sync before editing. Stop now?"
          confirmLabel="Stop Sync"
          cancelLabel="Cancel"
          onConfirm={handleConfirmEdit}
          onClose={handleCloseEditConfirm}
          confirmClassName="sync-btn-primary sync-btn-compact"
          cancelClassName="sync-btn-secondary sync-btn-compact"
        />
      ) : null}

      {showDeleteConfirm ? (
        <ConfirmDialog
          tone="warning"
          title="Warning"
          message="Do you really want to delete this sync?"
          confirmLabel={isDeleting ? "Deleting..." : "Delete"}
          cancelLabel="Close"
          onConfirm={handleDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          isConfirmDisabled={isDeleting}
          confirmClassName="sync-btn-warning sync-btn-compact"
          cancelClassName="sync-btn-secondary sync-btn-compact"
        />
      ) : null}

      {showStartSyncModal ? (
        <StartSyncDialog
          onClose={() => setShowStartSyncModal(false)}
          onPreviewFirst={handlePreviewFirst}
          onStartImmediately={handleStartImmediately}
        />
      ) : null}
    </div>
  );
};
