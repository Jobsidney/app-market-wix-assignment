import { hubspotBaseFields } from "./constants";
import type { MappingRow } from "./types";

export function entityPlural(name: string): string {
  const map: Record<string, string> = {
    Company: "Companies",
    Contact: "Contacts",
    Lead: "Leads",
    "Custom object": "Custom objects",
    Deal: "Deals",
    Task: "Tasks",
  };
  return map[name] ?? `${name}s`;
}

export function buildDefaultMappings(): MappingRow[] {
  const defaults: Record<string, string> = {
    firstname: "contactInfo.firstName",
    lastname: "contactInfo.lastName",
    email: "primaryInfo.email",
    phone: "primaryInfo.phone",
    website: "primaryInfo.website",
    jobtitle: "extendedFields.jobTitle",
    address: "extendedFields.address",
  };
  return hubspotBaseFields.map((hub, index) => ({
    id: `hub-${hub}-${index}`,
    hubspotField: hub,
    wixField: defaults[hub] ?? "",
    syncDirection: "bidirectional",
    transformRule: hub === "email" ? "lowercase" : "",
  }));
}

function titleCaseToken(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function wixFieldGroup(path: string): string {
  if (path.startsWith("contactInfo.")) return "Contact Info";
  if (path.startsWith("primaryInfo.")) return "Primary Info";
  if (path.startsWith("extendedFields.")) return "Extended Fields";
  return "Other";
}

export function wixFieldLabel(path: string): string {
  const last = path.split(".").pop() ?? path;
  const alias: Record<string, string> = {
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    website: "Website",
    jobTitle: "Job title",
    address: "Address",
    utm_source: "UTM source",
    utm_medium: "UTM medium",
    utm_campaign: "UTM campaign",
  };
  return alias[last] ?? titleCaseToken(last);
}

export function hubspotFieldGroup(name: string): string {
  const key = name.trim().toLowerCase();
  if (["email", "firstname", "lastname", "phone"].includes(key)) return "Identity";
  if (["website", "jobtitle", "address", "company"].includes(key)) return "Profile";
  if (key.startsWith("utm_")) return "Attribution";
  if (key.startsWith("hs_") || ["id", "createdat", "updatedat", "createdate", "lastmodifieddate"].includes(key)) {
    return "System";
  }
  return "Custom";
}

export function hubspotFieldLabel(name: string, label?: string): string {
  const preferred = (label ?? "").trim();
  if (preferred) return preferred;
  return titleCaseToken(name);
}
