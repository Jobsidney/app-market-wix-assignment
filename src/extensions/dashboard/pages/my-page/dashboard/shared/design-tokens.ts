import type { CSSProperties } from "react";

export const ds = {
  pageBg: "#F0F2F5",
  card: "#FFFFFF",
  ink: "#111827",
  text: "#334155",
  muted: "#6B7280",
  line: "#E5E7EB",
  lineSoft: "#F3F4F6",
  hair: "rgba(15, 23, 42, 0.07)",
  surfaceInset: "#FAFBFC",
  blue: "#007BFF",
  blueSoft: "#EFF6FF",
  blueLine: "#BFDBFE",
  greenBadge: "#22C55E",
  greenBg: "#E8F6EE",
  greenBorder: "#B8E0C8",
  greenInk: "#166534",
  shadowMain: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 18px rgba(15, 23, 42, 0.05)",
  shadowModal: "0 24px 64px rgba(15, 23, 42, 0.18)",
  radius: 4,
  cardRadius: 8,
  nestBorder: "#EAEAEA",
  nav: "#00214D",
  trial: "#00214D",
  help: "#FACC15",
  stepperBlue: "#3876D2",
  stepperLocked: "#CCCCCC",
  stepperDone: "#6B7280",
  stepperRule: "#EEEEEE",
} as const;

export const shellCard: CSSProperties = {
  border: "none",
  borderRadius: ds.cardRadius,
  background: ds.card,
  padding: 24,
  boxShadow: ds.shadowMain,
};

export const mainStageCard: CSSProperties = {
  border: "none",
  borderRadius: ds.cardRadius,
  background: ds.card,
  boxShadow: ds.shadowMain,
};

export const inputBase: CSSProperties = {
  width: "100%",
  border: `1px solid ${ds.line}`,
  borderRadius: ds.radius,
  padding: "10px 12px",
  fontSize: 14,
  color: ds.text,
  background: ds.card,
  boxSizing: "border-box" as const,
};
