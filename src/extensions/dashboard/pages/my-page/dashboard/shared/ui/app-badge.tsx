import type { FC } from "react";

export type AppBadgeProps = {
  app: "hubspot" | "wix";
  badgeSize?: number;
  logoSize?: number;
};

const HubspotLogo: FC<{ size: number }> = ({ size }) => {
  const stroke = Math.max(1.2, size * 0.11);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="#FF7A59" />
      <circle cx="12" cy="3.8" r="2" fill="#FF7A59" />
      <circle cx="19.4" cy="7" r="2" fill="#FF7A59" />
      <circle cx="19.4" cy="17" r="2" fill="#FF7A59" />
      <line x1="12" y1="6.4" x2="12" y2="9" stroke="#FF7A59" strokeWidth={stroke} strokeLinecap="round" />
      <line x1="15.3" y1="10.3" x2="17.7" y2="8.5" stroke="#FF7A59" strokeWidth={stroke} strokeLinecap="round" />
      <line x1="15.3" y1="13.7" x2="17.9" y2="15.7" stroke="#FF7A59" strokeWidth={stroke} strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.9" fill="#FFFFFF" opacity="0.95" />
      <circle cx="12" cy="12" r="0.9" fill="#FF7A59" />
    </svg>
  );
};

const WixLogo: FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 20" aria-hidden="true">
    <text
      x="16"
      y="14"
      textAnchor="middle"
      fontSize="11"
      fontWeight="800"
      letterSpacing="0.8"
      fill="#0F172A"
      fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    >
      WIX
    </text>
  </svg>
);

export const AppBadge: FC<AppBadgeProps> = ({ app, badgeSize = 24.2, logoSize = 15.4 }) => (
  <span
    style={{
      width: badgeSize,
      height: badgeSize,
      borderRadius: 999,
      border: "1px solid #E2E8F0",
      background: "#FFFFFF",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    }}
    aria-label={app === "hubspot" ? "HubSpot" : "Wix"}
    title={app === "hubspot" ? "HubSpot" : "Wix"}
  >
    {app === "hubspot" ? <HubspotLogo size={logoSize} /> : <WixLogo size={logoSize} />}
  </span>
);
