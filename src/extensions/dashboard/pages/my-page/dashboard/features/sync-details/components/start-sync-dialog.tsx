import { ModalOverlay } from "./confirm-dialog";

type Props = {
  onClose: () => void;
  onPreviewFirst: () => void;
  onStartImmediately: () => void;
};

export function StartSyncDialog({ onClose, onPreviewFirst, onStartImmediately }: Props) {
  return (
    <ModalOverlay>
      <div className="sync-details-card sync-details-card--start-modal">
        <div className="sync-details-modal-header">
          <strong className="sync-details-start-modal-title">Start Sync</strong>
          <button type="button" onClick={onClose} className="sync-icon-button sync-icon-button-lg">
            ×
          </button>
        </div>
        <div className="sync-details-start-modal-copy">
          Your sync will first process existing records and then continue syncing future changes.
        </div>
        <div className="sync-details-start-modal-copy">How would you like to start?</div>
        <button type="button" className="sync-details-start-option sync-details-start-option--primary" onClick={onPreviewFirst}>
          <div className="sync-details-start-option-title">Preview changes first</div>
          <div className="sync-details-start-option-subtitle">Generate a preview of records that will be synced</div>
        </button>
        <button type="button" className="sync-details-start-option sync-details-start-option--secondary" onClick={onStartImmediately}>
          <div className="sync-details-start-option-title">Start syncing immediately</div>
          <div className="sync-details-start-option-subtitle">Existing records will start syncing right away.</div>
        </button>
      </div>
    </ModalOverlay>
  );
}
