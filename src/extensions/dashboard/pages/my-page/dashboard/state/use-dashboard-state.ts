import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api/api-client";
import { wixFieldPalette } from "../shared/constants";
import { buildDefaultMappings } from "../shared/mapping-utils";
import { getSyncJobAction } from "../shared/sync-job-utils";
import { buildSyncName } from "../shared/sync-name-utils";
import type {
  DataSyncOption,
  ExistingRecordPolicy,
  HubspotPropertyOption,
  MappingRow,
  SyncDefinition,
  SyncDirection,
  SyncJob,
  ViewSettingsSection,
  WizardStep,
} from "../shared/types";

function normalizeSyncDirection(value: string): SyncDirection {
  if (value === "hubspot_to_wix" || value === "wix_to_hubspot" || value === "bidirectional") {
    return value;
  }
  return "bidirectional";
}

function sameSyncId(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return String(a) === String(b);
}

export function useDashboardState() {
  const defaultSyncBaseName = buildSyncName("bidirectional", "Contact", "Contact");
  type SyncJobsResponse = { jobs: SyncJob[]; managedRecordsCount?: number };
  const [dashboardMode, setDashboardMode] = useState<"list" | "wizard" | "details">("wizard");
  const [selectedSyncName, setSelectedSyncName] = useState<string | null>(null);
  const [selectedSyncId, setSelectedSyncId] = useState<number | null>(null);
  const [syncDefinitions, setSyncDefinitions] = useState<SyncDefinition[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingConnection, setIsTogglingConnection] = useState(false);
  const [mappings, setMappings] = useState<MappingRow[]>(() => buildDefaultMappings());
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [detailsManagedRecordsCount, setDetailsManagedRecordsCount] = useState(0);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>("connect_apps");
  const [syncOption, setSyncOption] = useState<DataSyncOption>("existing_and_future");
  const [syncDirection, setSyncDirection] = useState<SyncDirection>("bidirectional");
  const [existingRecordPolicy, setExistingRecordPolicy] = useState<ExistingRecordPolicy>("hubspot_to_wix");
  const [search, setSearch] = useState("");
  const [hubspotPropertyOptions, setHubspotPropertyOptions] = useState<HubspotPropertyOption[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState("Never");
  const [previewPhase, setPreviewPhase] = useState<"idle" | "generating" | "ready">("idle");
  const [syncStarted, setSyncStarted] = useState(false);
  const [postWizardPhase, setPostWizardPhase] = useState<null | "historical" | "success_overlay" | "summary">(null);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const getSyncQuery = (syncId: number | null) => (syncId ? `?syncId=${encodeURIComponent(String(syncId))}` : "");

  const selectedSync = useMemo(
    () => syncDefinitions.find((sync) => sameSyncId(sync.id, selectedSyncId)) ?? null,
    [syncDefinitions, selectedSyncId],
  );

  const [isTogglingLive, setIsTogglingLive] = useState(false);
  const [historySearchId, setHistorySearchId] = useState("");
  const [historyDirectionFilter, setHistoryDirectionFilter] = useState<"all" | "wix_to_hubspot" | "hubspot_to_wix">("all");
  const [historyActionFilter, setHistoryActionFilter] = useState<"all" | "create" | "update">("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "done" | "failed" | "queued" | "processing">("all");
  const historicalTimerRef = useRef<number | null>(null);
  const [maxUnlockedStepIndex, setMaxUnlockedStepIndex] = useState(0);
  const [hubspotEntityType, setHubspotEntityType] = useState<string>("Contact");
  const [wixEntityType, setWixEntityType] = useState<string>("Contact");
  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "connect_apps", label: "Connect apps" },
    { id: "map_tables", label: "Map tables" },
    { id: "sync_data_options", label: "Sync data options" },
    { id: "sync_direction", label: "Sync direction" },
    { id: "map_fields", label: "Map fields" },
    { id: "review", label: "Review" },
  ];

  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const currentStepLabel = steps[Math.max(0, currentStepIndex)]?.label ?? "";
  const mappedWixFields = new Set(mappings.map((row) => row.wixField).filter(Boolean));
  const availableWixFields = wixFieldPalette
    .filter((field) => !mappedWixFields.has(field))
    .filter((field) => field.toLowerCase().includes(search.toLowerCase()));
  const headerRightActionLabel = useMemo(() => {
    if (step === "map_fields") {
      return "Save & Continue";
    }
    if (step === "review") {
      if (previewPhase === "generating") {
        return "Generating...";
      }
      if (previewPhase === "ready" && !syncStarted) {
        return "Start Sync";
      }
    }
    return "Continue";
  }, [step, previewPhase, syncStarted]);

  const syncOptionLabel = useMemo(() => {
    const labels: Record<DataSyncOption, string> = {
      existing_and_future: "Existing Data and Future Changes",
      existing_only: "Existing Data Only",
      future_only: "Future Changes Only",
    };
    return labels[syncOption];
  }, [syncOption]);

  const persistSyncMetadata = useCallback(
    async (override?: Partial<Pick<SyncDefinition, "syncDirection" | "syncOption" | "existingRecordPolicy" | "hubspotEntity" | "wixEntity">>) => {
      if (!selectedSyncId) {
        return null;
      }
      const nextDirection = (override?.syncDirection as SyncDirection | undefined) ?? syncDirection;
      const nextHubspotEntity = override?.hubspotEntity ?? hubspotEntityType;
      const nextWixEntity = override?.wixEntity ?? wixEntityType;
      const nextSyncOption = override?.syncOption ?? syncOption;
      const nextExistingPolicy = override?.existingRecordPolicy ?? existingRecordPolicy;
      const updated = await apiRequest<{ sync: SyncDefinition }>(`/dashboard/syncs/${selectedSyncId}`, {
        method: "PATCH",
        body: JSON.stringify({
          syncOption: nextSyncOption,
          syncDirection: nextDirection,
          existingRecordPolicy: nextExistingPolicy,
          hubspotEntity: nextHubspotEntity,
          wixEntity: nextWixEntity,
        }),
      });
      setSyncDefinitions((prev) => prev.map((sync) => (sync.id === updated.sync.id ? updated.sync : sync)));
      setSelectedSyncName(updated.sync.name);
      return updated.sync;
    },
    [
      existingRecordPolicy,
      hubspotEntityType,
      selectedSyncId,
      syncDirection,
      syncOption,
      wixEntityType,
    ],
  );

  const hasConfiguredMappings = useMemo(() => mappings.some((row) => row.wixField.trim().length > 0), [mappings]);

  const managedRecordsCount = useMemo(() => {
    if (dashboardMode === "details" || postWizardPhase === "summary" || postWizardPhase === "success_overlay") {
      const keys = new Set(
        jobs
          .map((job) => {
            const payload = job.payload ?? {};
            return (
              (typeof payload.wixContactId === "string" && payload.wixContactId.trim()) ||
              (typeof payload.hubspotContactId === "string" && payload.hubspotContactId.trim()) ||
              (typeof payload.submissionId === "string" && payload.submissionId.trim()) ||
              ""
            );
          })
          .filter((value) => value.length > 0),
      );
      return keys.size;
    }
    return syncDefinitions.length;
  }, [dashboardMode, jobs, postWizardPhase, syncDefinitions.length]);

  const directionStats = useMemo(() => {
    const done = jobs.filter((j) => j.status === "done");
    const wixToHub = done.filter((j) => j.event_source === "wix");
    const hubToWix = done.filter((j) => j.event_source === "hubspot");
    const countCreate = (arr: SyncJob[]) => arr.filter((j) => getSyncJobAction(j) === "create").length;
    const countUpdate = (arr: SyncJob[]) => arr.filter((j) => getSyncJobAction(j) === "update").length;
    return {
      wixToHubCreated: countCreate(wixToHub),
      wixToHubUpdated: countUpdate(wixToHub),
      wixToHubDeleted: 0,
      hubToWixCreated: countCreate(hubToWix),
      hubToWixUpdated: countUpdate(hubToWix),
      hubToWixDeleted: 0,
    };
  }, [jobs]);

  const filteredHistoryJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (historySearchId.trim() && !String(job.id).includes(historySearchId.trim())) {
        return false;
      }
      if (historyDirectionFilter !== "all") {
        const src = job.event_source === "hubspot" ? "hubspot_to_wix" : "wix_to_hubspot";
        if (src !== historyDirectionFilter) {
          return false;
        }
      }
      if (historyActionFilter !== "all") {
        const act = getSyncJobAction(job);
        if (act !== historyActionFilter) {
          return false;
        }
      }
      if (historyStatusFilter !== "all" && job.status !== historyStatusFilter) {
        return false;
      }
      return true;
    });
  }, [jobs, historySearchId, historyDirectionFilter, historyActionFilter, historyStatusFilter]);

  useEffect(() => {
    return () => {
      if (historicalTimerRef.current !== null) {
        window.clearTimeout(historicalTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await apiRequest<{ connected: boolean }>("/connection/status");
        setConnected(status.connected);
        let syncsResult: { syncs: SyncDefinition[] } = { syncs: [] };
        let mappingResult: { mappings: Array<Omit<MappingRow, "id"> & { id: number }> } = { mappings: [] };
        let jobsResult: SyncJobsResponse = { jobs: [], managedRecordsCount: 0 };
        if (status.connected) {
          try {
            syncsResult = await apiRequest<{ syncs: SyncDefinition[] }>("/dashboard/syncs");
          } catch {
            syncsResult = { syncs: [] };
          }
          setSyncDefinitions(syncsResult.syncs);
          const firstSyncId = syncsResult.syncs[0]?.id ?? null;
          const firstSync = syncsResult.syncs[0] ?? null;
          setSelectedSyncId(firstSyncId);
          setSelectedSyncName(firstSync?.name ?? null);
          setLiveEnabled(firstSync?.live ?? true);
          if (firstSync) {
            setHubspotEntityType(firstSync.hubspotEntity || "Contact");
            setWixEntityType(firstSync.wixEntity || "Contact");
            if (
              firstSync.syncDirection === "wix_to_hubspot" ||
              firstSync.syncDirection === "hubspot_to_wix" ||
              firstSync.syncDirection === "bidirectional"
            ) {
              setSyncDirection(firstSync.syncDirection);
            }
            if (
              firstSync.syncOption === "existing_and_future" ||
              firstSync.syncOption === "existing_only" ||
              firstSync.syncOption === "future_only"
            ) {
              setSyncOption(firstSync.syncOption);
            }
            if (firstSync.existingRecordPolicy === "wix_to_hubspot" || firstSync.existingRecordPolicy === "hubspot_to_wix") {
              setExistingRecordPolicy(firstSync.existingRecordPolicy);
            }
          }
          try {
            mappingResult = await apiRequest<{ mappings: Array<Omit<MappingRow, "id"> & { id: number }> }>(
              `/mappings${getSyncQuery(firstSyncId)}`,
            );
          } catch {
            mappingResult = { mappings: [] };
          }
          try {
            jobsResult = await apiRequest<SyncJobsResponse>(`/dashboard/sync-jobs${getSyncQuery(firstSyncId)}`);
          } catch {
            jobsResult = { jobs: [], managedRecordsCount: 0 };
          }
        }
        if (mappingResult.mappings.length > 0) {
          setMappings(
            mappingResult.mappings.map((row) => ({
              id: row.id,
              wixField: row.wixField,
              hubspotField: row.hubspotField,
              syncDirection: row.syncDirection,
              transformRule: row.transformRule ?? "",
            })),
          );
        } else {
          setMappings(buildDefaultMappings());
        }
        setJobs(jobsResult.jobs);
        setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
        const hasSavedSync = status.connected && syncsResult.syncs.length > 0;
        setDashboardMode(hasSavedSync ? "list" : "wizard");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!connected) {
      setHubspotPropertyOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequest<{ properties: HubspotPropertyOption[] }>("/dashboard/hubspot/properties");
        if (!cancelled) {
          setHubspotPropertyOptions(res.properties);
        }
      } catch {
        if (!cancelled) {
          setHubspotPropertyOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (dashboardMode !== "details") {
      return;
    }
    setLiveEnabled(selectedSync?.live ?? true);
  }, [dashboardMode, selectedSync]);

  const handleConnectToggle = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsTogglingConnection(true);
    try {
      if (connected) {
        await apiRequest("/connection", { method: "DELETE" });
        setConnected(false);
      } else {
        const { authorizeUrl } = await apiRequest<{ authorizeUrl: string }>("/connection/authorize-url");
        window.open(authorizeUrl, "_blank");
      }
    } catch {
      setErrorMessage("Unable to update connection state.");
    } finally {
      setIsTogglingConnection(false);
    }
  };

  const patchSyncLive = async (next: boolean): Promise<boolean> => {
    if (isTogglingLive) {
      return false;
    }
    setIsTogglingLive(true);
    setErrorMessage(null);
    try {
      const effectiveSyncId = selectedSyncId ?? selectedSync?.id ?? null;
      if (!effectiveSyncId) {
        throw new Error("No sync selected.");
      }
      const r = await apiRequest<{ sync: SyncDefinition }>(`/dashboard/syncs/${effectiveSyncId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ live: next }),
      });
      setSyncDefinitions((prev) => prev.map((s) => (sameSyncId(s.id, r.sync.id) ? r.sync : s)));
      setSelectedSyncId(r.sync.id);
      setSelectedSyncName(r.sync.name);
      setLiveEnabled(r.sync.live);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update sync state.");
      return false;
    } finally {
      setIsTogglingLive(false);
    }
  };

  const persistMappings = async (): Promise<void> => {
    if (!selectedSyncId) {
      throw new Error("No sync selected.");
    }
    setIsSavingMappings(true);
    try {
      const payload = mappings
        .filter((row) => row.wixField.trim().length > 0 && row.hubspotField.trim().length > 0)
        .map((row) => ({
          wixField: row.wixField.trim(),
          hubspotField: row.hubspotField.trim(),
          syncDirection: syncDirection === "bidirectional" ? row.syncDirection : syncDirection,
          transformRule: row.transformRule.trim() || null,
        }));
      const result = await apiRequest<{ mappings: Array<Omit<MappingRow, "id"> & { id: number }> }>(
        `/mappings${getSyncQuery(selectedSyncId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ mappings: payload }),
        },
      );
      setMappings(
        result.mappings.map((row) => ({
          id: row.id,
          wixField: row.wixField,
          hubspotField: row.hubspotField,
          syncDirection: row.syncDirection,
          transformRule: row.transformRule ?? "",
        })),
      );
      const savedAt = new Date().toLocaleTimeString();
      setLastSavedAt(savedAt);
      setSuccessMessage(`Mappings saved at ${savedAt}.`);
    } finally {
      setIsSavingMappings(false);
    }
  };

  const goNext = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (step === "connect_apps" && !connected) {
      setErrorMessage("Connect HubSpot before continuing.");
      return;
    }
    if (step === "map_fields") {
      try {
        await persistSyncMetadata();
        await persistMappings();
      } catch {
        setErrorMessage("Unable to save mappings.");
        return;
      }
      setPreviewPhase("generating");
      setSyncStarted(false);
      setStep("review");
      setMaxUnlockedStepIndex((m) => Math.max(m, 5));
      window.setTimeout(() => {
        setPreviewPhase("ready");
      }, 1400);
      return;
    }
    if (step === "sync_direction") {
      try {
        await persistSyncMetadata();
      } catch {
        setErrorMessage("Unable to save sync direction.");
        return;
      }
      const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
      const next = steps[nextIndex];
      setStep(next.id);
      setMaxUnlockedStepIndex((m) => Math.max(m, nextIndex));
      return;
    }
    if (step === "review") {
      if (previewPhase === "generating") {
        return;
      }
      if (previewPhase === "ready" && !syncStarted) {
        const didStart = await patchSyncLive(true);
        if (!didStart) {
          return;
        }
        setSyncStarted(true);
        setSuccessMessage(null);
        try {
          const jobsResult = await apiRequest<SyncJobsResponse>(`/dashboard/sync-jobs${getSyncQuery(selectedSyncId)}`);
          setJobs(jobsResult.jobs);
          setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
        } catch {
          /* keep existing jobs */
        }
        setPostWizardPhase("historical");
        if (historicalTimerRef.current !== null) {
          window.clearTimeout(historicalTimerRef.current);
        }
        historicalTimerRef.current = window.setTimeout(() => {
          void (async () => {
            try {
              const jobsResult = await apiRequest<SyncJobsResponse>(
                `/dashboard/sync-jobs${getSyncQuery(selectedSyncId)}`,
              );
              setJobs(jobsResult.jobs);
              setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
            } catch {
              /* keep list */
            }
            setPostWizardPhase("success_overlay");
            historicalTimerRef.current = null;
          })();
        }, 2800);
        return;
      }
              const jobsResult = await apiRequest<SyncJobsResponse>(
                `/dashboard/sync-jobs${getSyncQuery(selectedSyncId)}`,
              );
      setJobs(jobsResult.jobs);
      setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
      setSuccessMessage("Sync review refreshed.");
      return;
    }
    const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
    const next = steps[nextIndex];
    setStep(next.id);
    setMaxUnlockedStepIndex((m) => Math.max(m, nextIndex));
  };

  const goBack = () => {
    if (postWizardPhase === "summary") {
      setPostWizardPhase(null);
      setStep("connect_apps");
      setMaxUnlockedStepIndex(0);
      setHubspotEntityType("Contact");
      setWixEntityType("Contact");
      setSyncStarted(false);
      setPreviewPhase("idle");
      return;
    }
    const prev = steps[Math.max(0, currentStepIndex - 1)];
    setStep(prev.id);
    if (prev.id !== "review") {
      setPreviewPhase("idle");
      setSyncStarted(false);
    }
  };

  const updateRowHubspotField = (rowId: string | number, hubspotField: string) => {
    setMappings((prev) => prev.map((row) => (String(row.id) === String(rowId) ? { ...row, hubspotField } : row)));
  };

  const updateRowWixField = (rowId: string | number, wixField: string) => {
    setMappings((prev) => prev.map((row) => (String(row.id) === String(rowId) ? { ...row, wixField } : row)));
  };

  const updateRowTransformRule = (rowId: string | number, transformRule: string) => {
    setMappings((prev) => prev.map((row) => (String(row.id) === String(rowId) ? { ...row, transformRule } : row)));
  };

  const addMappingRow = () => {
    setMappings((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        hubspotField: "",
        wixField: "",
        syncDirection: "bidirectional" as const,
        transformRule: "",
      },
    ]);
  };

  const clearWixMapping = (rowId: string | number) => {
    setMappings((prev) => prev.map((row) => (String(row.id) === String(rowId) ? { ...row, wixField: "" } : row)));
  };

  const cycleRowDirection = (rowId: string | number) => {
    if (syncDirection !== "bidirectional") {
      return;
    }
    const order: Array<MappingRow["syncDirection"]> = ["hubspot_to_wix", "wix_to_hubspot", "bidirectional"];
    setMappings((prev) =>
      prev.map((row) => {
        if (String(row.id) !== String(rowId)) {
          return row;
        }
        const next = order[(order.indexOf(row.syncDirection) + 1) % order.length];
        return { ...row, syncDirection: next };
      }),
    );
  };

  const setDirectionForAllRows = (value: SyncDirection) => {
    setSyncDirection(value);
    if (value !== "bidirectional") {
      setMappings((prev) => prev.map((row) => ({ ...row, syncDirection: value })));
    }
  };

  const wizardStepSubtitle = useMemo((): string | null => {
    const copy: Partial<Record<WizardStep, string>> = {
      connect_apps: "Authorize two services to continue.",
      map_tables: "We have automatically mapped the tables.",
      sync_data_options: "Select which data to include in this sync.",
      sync_direction: "Choose how changes flow between HubSpot and Wix.",
      map_fields: "Pick a HubSpot property and the Wix contact field path for each row.",
      review: "Confirm settings before starting the historical sync.",
    };
    return copy[step] ?? null;
  }, [step]);

  const hasMappedFields = hasConfiguredMappings;

  const isCurrentStepComplete = useMemo(() => {
    if (step === "connect_apps") {
      return connected && hubspotEntityType.trim().length > 0 && wixEntityType.trim().length > 0;
    }
    if (step === "map_fields") {
      return hasMappedFields;
    }
    if (step === "review") {
      return previewPhase !== "generating" && !(previewPhase === "ready" && syncStarted);
    }
    return true;
  }, [connected, hubspotEntityType, wixEntityType, hasMappedFields, step, previewPhase, syncStarted]);

  const showContinueCta = isCurrentStepComplete;

  const startCreateSyncFlow = async () => {
    try {
      const existingNames = new Set(syncDefinitions.map((s) => s.name.trim().toLowerCase()));
      let suffix = 1;
      let nextName = defaultSyncBaseName;
      while (existingNames.has(nextName.trim().toLowerCase())) {
        suffix += 1;
        nextName = `${defaultSyncBaseName} ${suffix}`;
      }
      const created = await apiRequest<{ sync: SyncDefinition }>("/dashboard/syncs", {
        method: "POST",
        body: JSON.stringify({ name: nextName }),
      });
      setSyncDefinitions((prev) => [...prev, created.sync]);
      setSelectedSyncId(created.sync.id);
      setSelectedSyncName(created.sync.name);
      setLiveEnabled(created.sync.live);
    } catch {
      setErrorMessage("Unable to create a new sync.");
      return;
    }
    setDashboardMode("wizard");
    setPostWizardPhase(null);
    setStep("connect_apps");
    setMaxUnlockedStepIndex(0);
    setHubspotEntityType("Contact");
    setWixEntityType("Contact");
    setSyncStarted(false);
    setPreviewPhase("idle");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openEditSyncFlow = () => {
    setDashboardMode("wizard");
    setPostWizardPhase(null);
    setStep("connect_apps");
    setMaxUnlockedStepIndex(steps.length - 1);
    setPreviewPhase("idle");
    setSyncStarted(false);
    if (selectedSync) {
      setHubspotEntityType(selectedSync.hubspotEntity || "Contact");
      setWixEntityType(selectedSync.wixEntity || "Contact");
      if (
        selectedSync.syncDirection === "wix_to_hubspot" ||
        selectedSync.syncDirection === "hubspot_to_wix" ||
        selectedSync.syncDirection === "bidirectional"
      ) {
        setSyncDirection(selectedSync.syncDirection);
      }
      if (
        selectedSync.syncOption === "existing_and_future" ||
        selectedSync.syncOption === "existing_only" ||
        selectedSync.syncOption === "future_only"
      ) {
        setSyncOption(selectedSync.syncOption);
      }
      if (selectedSync.existingRecordPolicy === "wix_to_hubspot" || selectedSync.existingRecordPolicy === "hubspot_to_wix") {
        setExistingRecordPolicy(selectedSync.existingRecordPolicy);
      }
    }
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openEditSyncStep = (targetStep: ViewSettingsSection) => {
    openEditSyncFlow();
    setStep(targetStep);
  };

  const deleteCurrentSync = async () => {
    if (!selectedSyncId) {
      return;
    }
    await apiRequest<{ deleted: boolean }>(`/dashboard/syncs/${selectedSyncId}`, { method: "DELETE" });
    const remainingSyncs = syncDefinitions.filter((s) => s.id !== selectedSyncId);
    setSyncDefinitions(remainingSyncs);
    const nextSync = remainingSyncs[0] ?? null;
    setSelectedSyncId(nextSync?.id ?? null);
    setSelectedSyncName(nextSync?.name ?? null);
    setJobs([]);
    setMappings(buildDefaultMappings());
    setPostWizardPhase(null);
    setDashboardMode("list");
    setStep("connect_apps");
    setMaxUnlockedStepIndex(0);
    setPreviewPhase("idle");
    setSyncStarted(false);
    setLiveEnabled(nextSync?.live ?? false);
    setSuccessMessage("Sync deleted.");
  };

  const startSyncImmediatelyFromDetails = async () => {
    const didStart = await patchSyncLive(true);
    if (!didStart) {
      return;
    }
    setPostWizardPhase("historical");
    if (historicalTimerRef.current !== null) {
      window.clearTimeout(historicalTimerRef.current);
    }
    historicalTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const jobsResult = await apiRequest<SyncJobsResponse>(`/dashboard/sync-jobs${getSyncQuery(selectedSyncId)}`);
          setJobs(jobsResult.jobs);
          setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
        } catch {
          /* keep existing jobs */
        }
        setPostWizardPhase("summary");
        historicalTimerRef.current = null;
      })();
    }, 2800);
  };

  const clearHistoryFilters = () => {
    setHistorySearchId("");
    setHistoryDirectionFilter("all");
    setHistoryActionFilter("all");
    setHistoryStatusFilter("all");
  };

  const openSyncHome = async () => {
    setPostWizardPhase(null);
    setDashboardMode("list");
    try {
      const syncsResult = await apiRequest<{ syncs: SyncDefinition[] }>("/dashboard/syncs");
      setSyncDefinitions(syncsResult.syncs);
    } catch {
      /* no-op */
    }
  };

  const openSyncDetails = async (syncName?: string, syncId?: number) => {
    const resolvedSyncId = syncId ?? selectedSyncId;
    if (syncName) {
      setSelectedSyncName(syncName);
    }
    if (resolvedSyncId) {
      setSelectedSyncId(resolvedSyncId);
    }
    setDashboardMode("details");
    setPostWizardPhase("summary");
    try {
      const sync = syncDefinitions.find((s) => s.id === resolvedSyncId);
      if (sync) {
        setHubspotEntityType(sync.hubspotEntity || "Contact");
        setWixEntityType(sync.wixEntity || "Contact");
        if (sync.syncDirection === "wix_to_hubspot" || sync.syncDirection === "hubspot_to_wix" || sync.syncDirection === "bidirectional") {
          setSyncDirection(sync.syncDirection);
        }
      }
      const jobsResult = await apiRequest<SyncJobsResponse>(`/dashboard/sync-jobs${getSyncQuery(resolvedSyncId ?? null)}`);
      setJobs(jobsResult.jobs);
      setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
      const mappingsResult = await apiRequest<{ mappings: Array<Omit<MappingRow, "id"> & { id: number }> }>(
        `/mappings${getSyncQuery(resolvedSyncId ?? null)}`,
      );
      setMappings(
        mappingsResult.mappings.map((row) => ({
          id: row.id,
          wixField: row.wixField,
          hubspotField: row.hubspotField,
          syncDirection: row.syncDirection,
          transformRule: row.transformRule ?? "",
        })),
      );
    } catch {
      /* no-op */
    }
  };

  const syncHomeRows = useMemo(() => {
    if (!connected || syncDefinitions.length === 0) {
      return [];
    }
    return syncDefinitions.map((sync) => ({
      key: `sync-${sync.id}`,
      id: sync.id,
      name: sync.name,
      lastActivity: sync.updatedAt
        ? new Date(sync.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "—",
      status: sync.live ? "Live" : "Paused",
      syncType: sync.syncOption.replaceAll("_", " "),
      syncDirection: normalizeSyncDirection(sync.syncDirection),
      hubspotEntity: sync.hubspotEntity || "Contact",
      wixEntity: sync.wixEntity || "Contact",
    }));
  }, [connected, syncDefinitions]);
  const refreshSyncHistory = async () => {
    try {
      const jobsResult = await apiRequest<SyncJobsResponse>(`/dashboard/sync-jobs${getSyncQuery(selectedSyncId)}`);
      setJobs(jobsResult.jobs);
      setDetailsManagedRecordsCount(jobsResult.managedRecordsCount ?? 0);
    } catch {
      setErrorMessage("Could not refresh history.");
    }
  };
  return {
    addMappingRow,
    availableWixFields,
    clearWixMapping,
    connected,
    currentStepIndex,
    currentStepLabel,
    cycleRowDirection,
    dashboardMode,
    directionStats,
    errorMessage,
    existingRecordPolicy,
    setExistingRecordPolicy,
    filteredHistoryJobs,
    clearHistoryFilters,
    goBack,
    goNext,
    handleConnectToggle,
    hasMappedFields,
    headerRightActionLabel,
    historicalTimerRef,
    historyActionFilter,
    setHistoryActionFilter,
    historyDirectionFilter,
    setHistoryDirectionFilter,
    historySearchId,
    setHistorySearchId,
    historyStatusFilter,
    setHistoryStatusFilter,
    hubspotEntityType,
    hubspotPropertyOptions,
    setHubspotEntityType,
    isCurrentStepComplete,
    isLoading,
    isSavingMappings,
    isTogglingConnection,
    isTogglingLive,
    jobs,
    lastSavedAt,
    liveEnabled,
    detailsManagedRecordsCount,
    managedRecordsCount,
    mappings,
    maxUnlockedStepIndex,
    openSyncDetails,
    openEditSyncFlow,
    openEditSyncStep,
    openSyncHome,
    patchSyncLive,
    persistMappings,
    postWizardPhase,
    previewPhase,
    refreshSyncHistory,
    search,
    selectedSyncName,
    selectedSyncId,
    selectedSync,
    setDashboardMode,
    setErrorMessage,
    setJobs,
    setMappings,
    setMaxUnlockedStepIndex,
    setPostWizardPhase,
    setPreviewPhase,
    setSearch,
    setSelectedSyncName,
    setSelectedSyncId,
    setStep,
    setSuccessMessage,
    setSyncDirection,
    setSyncOption,
    setSyncStarted,
    setWixEntityType,
    setDirectionForAllRows,
    showContinueCta,
    startCreateSyncFlow,
    startSyncImmediatelyFromDetails,
    deleteCurrentSync,
    step,
    steps,
    successMessage,
    syncDirection,
    syncDefinitions,
    syncHomeRows,
    syncOption,
    syncOptionLabel,
    syncStarted,
    updateRowHubspotField,
    updateRowTransformRule,
    updateRowWixField,
    wizardStepSubtitle,
    wixEntityType,
  };
}

export type DashboardViewModel = ReturnType<typeof useDashboardState>;
