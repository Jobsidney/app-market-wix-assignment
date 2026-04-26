import type { FC } from "react";
import { ds, shellCard } from "../../shared/design-tokens";
import type { WizardStep } from "../../shared/types";
import type { DashboardViewModel } from "../../state";
import { WizardStepper } from "./components/wizard-stepper";
import { ConnectAppsStep } from "./steps/connect-apps-step";
import { MapFieldsStep } from "./steps/map-fields-step";
import { MapTablesStep } from "./steps/map-tables-step";
import { ReviewStep } from "./steps/review-step";
import { SyncDataOptionsStep } from "./steps/sync-data-options-step";
import { SyncDirectionStep } from "./steps/sync-direction-step";

type Props = {
  vm: DashboardViewModel;
};

const STEP_COMPONENTS: Record<WizardStep, FC<Props>> = {
  connect_apps: ConnectAppsStep,
  map_fields: MapFieldsStep,
  map_tables: MapTablesStep,
  review: ReviewStep,
  sync_data_options: SyncDataOptionsStep,
  sync_direction: SyncDirectionStep,
};

export const WizardShellView: FC<Props> = ({ vm }) => {
  const {
    currentStepIndex,
    currentStepLabel,
    errorMessage,
    existingRecordPolicy,
    goBack,
    goNext,
    headerRightActionLabel,
    hubspotEntityType,
    isLoading,
    isSavingMappings,
    isTogglingConnection,
    maxUnlockedStepIndex,
    openSyncHome,
    previewPhase,
    setStep,
    showContinueCta,
    step,
    steps,
    successMessage,
    syncDirection,
    syncStarted,
    wixEntityType,
    wizardStepSubtitle,
  } = vm;

  const StepComponent = STEP_COMPONENTS[step];
  const continueDisabled =
    isLoading ||
    isSavingMappings ||
    isTogglingConnection ||
    (step === "review" && previewPhase === "generating") ||
    (step === "review" && previewPhase === "ready" && syncStarted);

  return (
    <>
      <div className="sync-grid" style={{ gap: 22 }}>
        <section style={{ ...shellCard, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px" }}>
          <div style={{ fontSize: 11, color: ds.muted, letterSpacing: "0.01em" }}>
            <button
              type="button"
              onClick={() => void openSyncHome()}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ds.blue, fontSize: 11, letterSpacing: "0.01em", textDecoration: "underline" }}
            >
              Data Sync
            </button>
            {" / New Sync / "}{currentStepLabel.replaceAll("_", " ")}
          </div>
          {showContinueCta ? (
            <button
              className="sync-btn-primary"
              type="button"
              onClick={goNext}
              disabled={continueDisabled}
              style={{ border: `1px solid ${ds.blue}`, borderRadius: ds.radius, padding: "7px 12px", background: ds.blue, color: "#FFFFFF", fontWeight: 700 }}
            >
              {headerRightActionLabel}
            </button>
          ) : null}
        </section>

        <WizardStepper currentStepIndex={currentStepIndex} maxUnlockedStepIndex={maxUnlockedStepIndex} setStep={setStep} steps={steps} />

        {wizardStepSubtitle ? (
          <section style={{ ...shellCard, padding: "16px 28px", fontSize: 13, color: ds.muted }}>{wizardStepSubtitle}</section>
        ) : null}

        <StepComponent vm={vm} />

        <section style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12 }}>
          <button
            className="sync-btn-secondary"
            type="button"
            onClick={goBack}
            disabled={currentStepIndex === 0}
            style={{ border: `1px solid ${ds.line}`, borderRadius: ds.radius, padding: "7px 12px", background: ds.card, color: ds.text, boxShadow: "none" }}
          >
            Go back
          </button>
          <div style={{ fontSize: 12, color: ds.muted, textAlign: "center" }}>
            Entities: {hubspotEntityType} ↔ {wixEntityType} | Sync: {syncDirection.replaceAll("_", " ")} | Existing:{" "}
            {existingRecordPolicy.replaceAll("_", " ")}
          </div>
          {showContinueCta ? (
            <button
              className="sync-btn-primary"
              type="button"
              onClick={goNext}
              disabled={continueDisabled}
              style={{ border: `1px solid ${ds.blue}`, borderRadius: ds.radius, padding: "7px 12px", background: ds.blue, color: "#FFFFFF", fontWeight: 700 }}
            >
              {headerRightActionLabel}
            </button>
          ) : null}
        </section>

        {errorMessage ? (
          <section style={{ ...shellCard, background: "#FFF5F5", color: "#A51C14", padding: "14px 22px" }}>{errorMessage}</section>
        ) : null}
        {successMessage ? (
          <section style={{ ...shellCard, background: "#F1FCF7", color: "#006C43", padding: "14px 22px" }}>{successMessage}</section>
        ) : null}
      </div>
    </>
  );
};
