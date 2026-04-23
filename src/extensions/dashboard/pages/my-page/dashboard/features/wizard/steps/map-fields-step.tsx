import { useMemo } from "react";
import type { FC } from "react";
import { hubspotBaseFields, wixFieldPalette } from "../../../shared/constants";
import { ds, shellCard } from "../../../shared/design-tokens";
import { entityPlural, hubspotFieldGroup, hubspotFieldLabel, wixFieldGroup, wixFieldLabel } from "../../../shared/mapping-utils";
import type { DashboardViewModel } from "../../../state";

type Props = {
  vm: DashboardViewModel;
};

export const MapFieldsStep: FC<Props> = ({ vm }) => {
  const {
    addMappingRow,
    availableWixFields,
    clearWixMapping,
    connected,
    cycleRowDirection,
    hubspotEntityType,
    hubspotPropertyOptions,
    isSavingMappings,
    lastSavedAt,
    mappings,
    persistMappings,
    search,
    setSearch,
    syncDirection,
    updateRowHubspotField,
    updateRowTransformRule,
    updateRowWixField,
    wixEntityType,
  } = vm;

  const groupedWixFields = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const field of wixFieldPalette) {
      const group = wixFieldGroup(field);
      const existing = groups.get(group) ?? [];
      existing.push(field);
      groups.set(group, existing);
    }

    return Array.from(groups.entries()).map(([group, fields]) => ({
      group,
      fields: fields.sort((left, right) => wixFieldLabel(left).localeCompare(wixFieldLabel(right))),
    }));
  }, []);

  return (
    <div className="sync-grid sync-gap-12">
      <div
        style={{
          ...shellCard,
          padding: "12px 16px",
          background: ds.blueSoft,
          boxShadow: "0 0 0 1px rgba(191, 219, 254, 0.65)",
        }}
      >
        <strong style={{ fontSize: 20, color: ds.ink }}>Real-Time Sync</strong>
        <div style={{ fontSize: 13, color: ds.muted, marginTop: 2 }}>Settings for syncing future changes.</div>
      </div>

      <div
        style={{
          ...shellCard,
          padding: "10px 16px",
          background: ds.blueSoft,
          fontSize: 13,
          color: ds.text,
          boxShadow: "0 0 0 1px rgba(191, 219, 254, 0.65)",
        }}
      >
        HubSpot property names load from your portal when HubSpot is connected. Choose a property and a Wix field path per row.
        {connected && hubspotPropertyOptions.length === 0 ? (
          <span style={{ display: "block", marginTop: 6, color: ds.muted }}>Loading HubSpot property list…</span>
        ) : null}
      </div>

      <div style={{ ...shellCard, display: "grid", gridTemplateColumns: "1fr minmax(260px, 0.42fr)", gap: 20 }}>
        <div
          style={{
            borderRadius: ds.cardRadius,
            overflow: "hidden",
            background: ds.surfaceInset,
            border: `1px solid ${ds.nestBorder}`,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 1fr 118px",
              background: ds.surfaceInset,
              padding: "12px 16px",
              fontWeight: 700,
              fontSize: 12,
              color: "#64748B",
              letterSpacing: "0.02em",
              borderBottom: `1px solid ${ds.hair}`,
            }}
          >
            <span>HubSpot property</span>
            <span style={{ textAlign: "center" }}>Direction</span>
            <span>Wix field</span>
            <span>Transform</span>
          </div>

          {mappings.map((row) => {
            const wixField = row.wixField ?? "";
            const rowDirection = syncDirection === "bidirectional" ? row.syncDirection : syncDirection;
            const activeCenter = syncDirection === "bidirectional" && rowDirection === "bidirectional";
            const hubspotOptions =
              hubspotPropertyOptions.length > 0 ? hubspotPropertyOptions : hubspotBaseFields.map((name) => ({ name, label: name }));
            const groupedHubspotFields = (() => {
              const groups = new Map<string, Array<{ label: string; name: string }>>();

              for (const option of hubspotOptions) {
                const group = hubspotFieldGroup(option.name);
                const existing = groups.get(group) ?? [];
                existing.push(option);
                groups.set(group, existing);
              }

              return Array.from(groups.entries()).map(([group, options]) => ({
                group,
                options: options.sort((left, right) =>
                  hubspotFieldLabel(left.name, left.label).localeCompare(hubspotFieldLabel(right.name, right.label)),
                ),
              }));
            })();

            return (
              <div
                key={String(row.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 1fr 118px",
                  gap: 8,
                  padding: "10px 14px",
                  borderTop: `1px solid ${ds.hair}`,
                }}
              >
                <select
                  className="sync-input"
                  style={{ fontSize: 13, margin: 0 }}
                  value={row.hubspotField}
                  onChange={(event) => updateRowHubspotField(row.id, event.target.value)}
                >
                  <option value="">— HubSpot —</option>
                  {groupedHubspotFields.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map((option) => (
                        <option key={option.name} value={option.name}>
                          {`${hubspotFieldLabel(option.name, option.label)} (${option.name})`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => cycleRowDirection(row.id)}
                    disabled={syncDirection !== "bidirectional"}
                    style={{
                      border: `1px solid ${ds.blueLine}`,
                      background: rowDirection === "wix_to_hubspot" ? ds.blue : ds.blueSoft,
                      color: rowDirection === "wix_to_hubspot" ? "#FFFFFF" : ds.blue,
                      borderRadius: 6,
                      padding: "2px 6px",
                      cursor: syncDirection === "bidirectional" ? "pointer" : "default",
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleRowDirection(row.id)}
                    disabled={syncDirection !== "bidirectional"}
                    style={{
                      border: `1px solid ${ds.blue}`,
                      background: activeCenter ? ds.blue : ds.blueSoft,
                      color: activeCenter ? "#FFFFFF" : ds.blue,
                      borderRadius: 6,
                      padding: "2px 6px",
                      cursor: syncDirection === "bidirectional" ? "pointer" : "default",
                    }}
                  >
                    ↔
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleRowDirection(row.id)}
                    disabled={syncDirection !== "bidirectional"}
                    style={{
                      border: `1px solid ${ds.blueLine}`,
                      background: rowDirection === "hubspot_to_wix" ? ds.blue : ds.blueSoft,
                      color: rowDirection === "hubspot_to_wix" ? "#FFFFFF" : ds.blue,
                      borderRadius: 6,
                      padding: "2px 6px",
                      cursor: syncDirection === "bidirectional" ? "pointer" : "default",
                    }}
                  >
                    →
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                  <select
                    className="sync-input"
                    style={{ flex: 1, fontSize: 13, margin: 0 }}
                    value={wixField}
                    onChange={(event) => updateRowWixField(row.id, event.target.value)}
                  >
                    <option value="">— Wix —</option>
                    {groupedWixFields.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.fields.map((field) => (
                          <option key={field} value={field}>
                            {`${wixFieldLabel(field)} (${field})`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {wixField ? (
                    <button
                      type="button"
                      onClick={() => clearWixMapping(row.id)}
                      style={{
                        border: `1px solid ${ds.hair}`,
                        borderRadius: ds.radius,
                        padding: "0 10px",
                        background: ds.card,
                        color: ds.muted,
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <select
                  className="sync-input"
                  style={{ fontSize: 12, margin: 0, alignSelf: "center" }}
                  value={row.transformRule ?? ""}
                  onChange={(event) => updateRowTransformRule(row.id, event.target.value)}
                >
                  <option value="">None</option>
                  <option value="trim">trim</option>
                  <option value="lowercase">lowercase</option>
                  <option value="trim,lowercase">trim, lowercase</option>
                </select>
              </div>
            );
          })}

          <div style={{ padding: "10px 14px", borderTop: `1px solid ${ds.hair}` }}>
            <button
              type="button"
              className="sync-btn-secondary"
              onClick={addMappingRow}
              style={{ border: `1px solid ${ds.line}`, borderRadius: ds.radius, padding: "8px 12px", background: ds.card }}
            >
              Add mapping row
            </button>
          </div>
        </div>

        <div style={{ ...shellCard, padding: "22px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 22, color: ds.ink }}>Wix paths (reference)</h3>
          <div style={{ fontSize: 13, color: ds.muted, marginBottom: 8 }}>Browse common paths; mapping uses the dropdowns on the left.</div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="sync-input sync-search-input" />
          <div style={{ display: "grid", gap: 7, maxHeight: 440, overflow: "auto", paddingRight: 2 }}>
            {availableWixFields.map((field) => (
              <div
                key={field}
                style={{
                  border: `1px solid ${ds.hair}`,
                  borderRadius: ds.radius,
                  padding: "10px 12px",
                  background: ds.card,
                  fontSize: 13,
                  boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
                }}
              >
                {field}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${ds.lineSoft}` }}>
            <div style={{ fontSize: 12, color: ds.muted, marginBottom: 6 }}>Entities</div>
            <div style={{ fontSize: 13, color: ds.text }}>
              HubSpot {entityPlural(hubspotEntityType)} ↔ Wix {entityPlural(wixEntityType)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...shellCard, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <span style={{ fontSize: 13, color: ds.muted }}>Last saved: {lastSavedAt}</span>
        <button
          type="button"
          onClick={() => void persistMappings()}
          disabled={isSavingMappings}
          style={{ border: `1px solid ${ds.blue}`, borderRadius: ds.radius, padding: "8px 12px", background: ds.blue, color: "#FFFFFF", fontWeight: 700 }}
        >
          {isSavingMappings ? "Saving..." : "Save Mapping"}
        </button>
      </div>
    </div>
  );
};
