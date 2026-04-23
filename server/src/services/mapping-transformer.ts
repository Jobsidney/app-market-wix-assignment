import type { FieldMappingRow } from "./field-mapping-repo.js";

type Primitive = string | number | boolean | null | undefined;
type SourceRecord = Record<string, unknown>;

function getByPath(record: SourceRecord, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = record;
  for (const key of keys) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setByPath(record: SourceRecord, path: string, value: Primitive | SourceRecord): void {
  const keys = path.split(".");
  const last = keys.pop();
  if (!last) {
    return;
  }
  let current: SourceRecord = record;
  for (const key of keys) {
    const next = current[key];
    if (next === null || typeof next !== "object") {
      current[key] = {};
    }
    current = current[key] as SourceRecord;
  }
  current[last] = value;
}

function readFieldValue(source: SourceRecord, path: string): unknown {
  const nested = getByPath(source, path);
  if (nested !== undefined && nested !== null && nested !== "") {
    return nested;
  }
  if (path in source) {
    const direct = source[path];
    if (direct !== undefined && direct !== null && direct !== "") {
      return direct;
    }
  }
  const leaf = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : path;
  if (leaf !== path && leaf in source) {
    const leafVal = source[leaf];
    if (leafVal !== undefined && leafVal !== null && leafVal !== "") {
      return leafVal;
    }
  }
  return undefined;
}

export function applyTransformRule(value: unknown, rule: string | null | undefined): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  if (!rule || rule.trim() === "") {
    return value;
  }
  let out = value;
  for (const part of rule.split(",").map((s) => s.trim())) {
    if (part === "trim") {
      out = out.trim();
    } else if (part === "lowercase") {
      out = out.toLowerCase();
    }
  }
  return out;
}

export function transformByPersistedMappings(
  source: SourceRecord,
  rows: FieldMappingRow[],
  mode: "wix_to_hubspot" | "hubspot_to_wix",
): SourceRecord {
  const transformed: SourceRecord = {};
  for (const row of rows) {
    if (mode === "wix_to_hubspot") {
      if (row.syncDirection !== "wix_to_hubspot" && row.syncDirection !== "bidirectional") {
        continue;
      }
      const raw = readFieldValue(source, row.wixField);
      if (raw === undefined) {
        continue;
      }
      const value = applyTransformRule(raw, row.transformRule);
      setByPath(transformed, row.hubspotField, value as Primitive | SourceRecord);
    } else {
      if (row.syncDirection !== "hubspot_to_wix" && row.syncDirection !== "bidirectional") {
        continue;
      }
      const raw = readFieldValue(source, row.hubspotField);
      if (raw === undefined) {
        continue;
      }
      const value = applyTransformRule(raw, row.transformRule);
      setByPath(transformed, row.wixField, value as Primitive | SourceRecord);
    }
  }
  return transformed;
}
