import type { FC } from "react";
import { Page, WixDesignSystemProvider } from "@wix/design-system";
import "@wix/design-system/styles.global.css";
import "../my-page.css";
import { SyncDetailsDashboardView } from "./features/sync-details/index";
import { SyncHomeDashboardView } from "./features/sync-home/index";
import { HistoricalSyncView, SuccessOverlayView } from "./features/sync-progress/index";
import { WizardShellView } from "./features/wizard/index";
import { LayoutChrome } from "./layout/layout-chrome";
import { useDashboardState } from "./state/index";

const DashboardPage: FC = () => {
  const vm = useDashboardState();
  const showInitialSkeleton = vm.isLoading;
  const contentFlush =
    vm.postWizardPhase === "historical" || vm.postWizardPhase === "success_overlay" || vm.postWizardPhase === "summary";
  const contentStyle = contentFlush ? { padding: 0, maxWidth: "none" as const } : undefined;

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Content>
          <LayoutChrome
            onTitleClick={() => {
              void vm.openSyncHome();
            }}
            contentFlush={contentFlush}
            contentStyle={contentStyle}
          >
            {showInitialSkeleton ? (
              <div className="sync-initial-skeleton" aria-busy="true" aria-live="polite">
                <section className="sync-card sync-initial-skeleton-card">
                  <div className="sync-initial-skeleton-header">
                    <div className="sync-initial-skeleton-line sync-initial-skeleton-line--title" />
                    <div className="sync-initial-skeleton-line sync-initial-skeleton-line--button" />
                  </div>
                  <div className="sync-initial-skeleton-table-head" />
                  <div className="sync-initial-skeleton-row" />
                  <div className="sync-initial-skeleton-row" />
                  <div className="sync-initial-skeleton-row" />
                </section>
                <aside className="sync-card sync-initial-skeleton-side">
                  <div className="sync-initial-skeleton-line sync-initial-skeleton-line--side-title" />
                  <div className="sync-initial-skeleton-line sync-initial-skeleton-line--side-number" />
                  <div className="sync-initial-skeleton-line sync-initial-skeleton-line--side-caption" />
                  <div className="sync-initial-skeleton-progress" />
                </aside>
              </div>
            ) : vm.postWizardPhase === "historical" ? (
              <HistoricalSyncView />
            ) : vm.dashboardMode === "list" ? (
              <SyncHomeDashboardView vm={vm} />
            ) : vm.dashboardMode === "details" ? (
              <>
                <SyncDetailsDashboardView vm={vm} />
                {vm.postWizardPhase === "success_overlay" ? <SuccessOverlayView vm={vm} /> : null}
              </>
            ) : vm.postWizardPhase === "success_overlay" || vm.postWizardPhase === "summary" ? (
              <>
                <SyncDetailsDashboardView vm={vm} />
                {vm.postWizardPhase === "success_overlay" ? <SuccessOverlayView vm={vm} /> : null}
              </>
            ) : (
              <WizardShellView vm={vm} />
            )}
          </LayoutChrome>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default DashboardPage;
