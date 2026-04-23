import type { FC } from "react";
import { ds } from "../../../shared/design-tokens";
import type { WizardStep } from "../../../shared/types";

type Props = {
  currentStepIndex: number;
  maxUnlockedStepIndex: number;
  setStep: (step: WizardStep) => void;
  steps: Array<{ id: WizardStep; label: string }>;
};

export const WizardStepper: FC<Props> = ({ currentStepIndex, maxUnlockedStepIndex, setStep, steps }) => (
  <section
    style={{
      border: "none",
      borderRadius: ds.cardRadius,
      background: ds.card,
      boxShadow: ds.shadowMain,
      padding: "16px 24px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 28,
    }}
  >
    {steps.map((item, index) => {
      const reachable = index <= maxUnlockedStepIndex;
      const active = index === currentStepIndex;
      const completed = index < currentStepIndex;
      const label = item.label.replaceAll("_", " ");

      return (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            if (reachable) {
              setStep(item.id);
            }
          }}
          aria-current={active ? "step" : undefined}
          aria-disabled={!reachable}
          style={{
            border: "none",
            background: "transparent",
            padding: "6px 2px",
            cursor: reachable ? "pointer" : "not-allowed",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              textTransform: "capitalize",
              paddingBottom: 5,
              borderBottom: active ? `3px solid ${ds.stepperBlue}` : "3px solid transparent",
              color: active ? ds.stepperBlue : reachable ? ds.stepperDone : ds.stepperLocked,
              fontWeight: active ? 700 : 400,
            }}
          >
            {completed ? (
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  display: "inline-grid",
                  placeItems: "center",
                  fontSize: 10,
                  lineHeight: 1,
                  background: ds.greenBadge,
                  color: "#FFFFFF",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
            ) : null}
            {label}
          </span>
        </button>
      );
    })}
  </section>
);
