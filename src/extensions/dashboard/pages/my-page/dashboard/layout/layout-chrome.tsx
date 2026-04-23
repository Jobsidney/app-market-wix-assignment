import type { CSSProperties, FC, ReactNode } from "react";

export type LayoutChromeProps = {
  children: ReactNode;
  contentStyle?: CSSProperties;
  onTitleClick?: () => void;
  contentFlush?: boolean;
};

export const LayoutChrome: FC<LayoutChromeProps> = ({ children, contentStyle, onTitleClick, contentFlush }) => {
  return (
    <div className="sync-page">
      <div
        className={["sync-content-wrap", contentFlush ? "sync-content-wrap--flush" : ""].filter(Boolean).join(" ")}
        style={contentStyle}
      >
        {onTitleClick ? (
          <div className="sync-page-hero">
            <button type="button" className="sync-page-title" onClick={onTitleClick}>
              HubSpot Sync Center
            </button>
          </div>
        ) : null}
        {children}
      </div>
     
    </div>
  );
};
