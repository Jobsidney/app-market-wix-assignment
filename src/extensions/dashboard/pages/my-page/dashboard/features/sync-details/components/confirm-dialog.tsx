import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalOverlayProps = {
  children: ReactNode;
};

type ConfirmDialogTone = "info" | "warning";

type ConfirmDialogProps = {
  tone: ConfirmDialogTone;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isConfirmDisabled?: boolean;
  confirmClassName?: string;
  cancelClassName?: string;
};

export function ModalOverlay({ children }: ModalOverlayProps) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="sync-page sync-details-overlay">
      <div className="sync-details-dialog-wrap">{children}</div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  tone,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  isConfirmDisabled = false,
  confirmClassName,
  cancelClassName,
}: ConfirmDialogProps) {
  const dialogToneClass = tone === "warning" ? " sync-details-dialog--warning" : "";
  const resolvedConfirmClassName = confirmClassName ?? "sync-btn-primary sync-btn-compact";
  const resolvedCancelClassName = cancelClassName ?? "sync-btn-secondary sync-btn-compact";

  return (
    <ModalOverlay>
      <div className={`sync-details-card sync-details-card--dialog sync-details-dialog${dialogToneClass}`}>
        <div className="sync-details-dialog-header">
          <strong className="sync-details-dialog-title">{title}</strong>
          <button type="button" onClick={onClose} className="sync-icon-button sync-icon-button-lg">
            ×
          </button>
        </div>
        <div className="sync-details-dialog-message">{message}</div>
        <div className="sync-details-dialog-actions">
          <button
            type="button"
            disabled={isConfirmDisabled}
            className={resolvedConfirmClassName}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className={resolvedCancelClassName} onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
