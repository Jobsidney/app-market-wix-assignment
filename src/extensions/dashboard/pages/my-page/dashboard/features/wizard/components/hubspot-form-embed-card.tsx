import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../api/api-client";
import { ds, shellCard } from "../../../shared/design-tokens";

const REGIONS = ["na1", "eu1", "ap1"] as const;

type EmbedDto = { portalId: string; formId: string; region: string };

export const HubSpotFormEmbedCard: FC = () => {
  const [portalId, setPortalId] = useState("");
  const [formId, setFormId] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("na1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiRequest<EmbedDto>("/connection/hubspot-embed");
        if (!cancelled) {
          setPortalId(r.portalId ?? "");
          setFormId(r.formId ?? "");
          if (REGIONS.includes(r.region as (typeof REGIONS)[number])) {
            setRegion(r.region as (typeof REGIONS)[number]);
          }
          setLoadError(null);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load saved embed settings.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await apiRequest<EmbedDto>("/connection/hubspot-embed", {
        method: "PUT",
        body: JSON.stringify({
          portalId: portalId.trim(),
          formId: formId.trim(),
          region,
        }),
      });
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [portalId, formId, region]);

  const snippet = useMemo(() => {
    const pid = portalId.trim();
    const fid = formId.trim();
    if (!pid || !fid) {
      return "";
    }
    return `<div id="hs-form-wrap"></div>
<script charset="utf-8" src="https://js.hsforms.net/forms/embed/v2.js"></script>
<script>
  hbspt.forms.create({
    region: "${region}",
    portalId: "${pid}",
    formId: "${fid}",
    target: "#hs-form-wrap"
  });
</script>`;
  }, [portalId, formId, region]);

  return (
    <div className="sync-card" style={{ ...shellCard, padding: "18px 20px" }}>
      <h3 className="sync-h3" style={{ marginTop: 0 }}>
        Optional: embed a HubSpot form on your site
      </h3>
      <p style={{ fontSize: 13, color: ds.muted, marginTop: 0 }}>
        Save your portal and form here; submissions go to HubSpot. Use the snippet in a Wix HTML embed / custom element. For DB attribution, use the Wix form → backend path.
      </p>
      {loadError ? <p style={{ fontSize: 13, color: "#A51C14" }}>{loadError}</p> : null}
      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <label className="sync-label" htmlFor="hs-portal">
          HubSpot portal ID
        </label>
        <input id="hs-portal" className="sync-input" value={portalId} onChange={(e) => setPortalId(e.target.value)} placeholder="12345678" />
        <label className="sync-label" htmlFor="hs-form">
          Form GUID
        </label>
        <input id="hs-form" className="sync-input" value={formId} onChange={(e) => setFormId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        <label className="sync-label" htmlFor="hs-region">
          Region
        </label>
        <select id="hs-region" className="sync-input" value={region} onChange={(e) => setRegion(e.target.value as (typeof REGIONS)[number])}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="sync-btn-primary"
          disabled={saveState === "saving" || !portalId.trim() || !formId.trim()}
          onClick={() => void save()}
          style={{ border: `1px solid ${ds.blue}`, padding: "8px 12px", background: ds.blue, color: "#FFFFFF", fontWeight: 600, justifySelf: "start" }}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Retry save" : "Save embed settings"}
        </button>
      </div>
      {snippet ? (
        <div style={{ marginTop: 14 }}>
          <div className="sync-label">Embed code</div>
          <textarea readOnly className="sync-input" style={{ width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12 }} value={snippet} />
        </div>
      ) : null}
    </div>
  );
};
