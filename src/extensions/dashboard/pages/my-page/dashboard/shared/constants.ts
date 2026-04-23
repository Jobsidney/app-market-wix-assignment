export const hubspotBaseFields = [
  "id",
  "createdAt",
  "updatedAt",
  "firstname",
  "lastname",
  "email",
  "phone",
  "website",
  "jobtitle",
  "address",
] as const;

export const wixFieldPalette = [
  "contactInfo.firstName",
  "contactInfo.lastName",
  "primaryInfo.email",
  "primaryInfo.phone",
  "primaryInfo.website",
  "extendedFields.jobTitle",
  "extendedFields.address",
  "extendedFields.utm_source",
  "extendedFields.utm_medium",
  "extendedFields.utm_campaign",
] as const;

/** Only Contact is implemented end-to-end (CRM + forms → HubSpot contacts). */
export const SYNC_DATA_TYPES = ["Contact"] as const;

export const WIX_LOGO_URL = "https://sm.pcmag.com/pcmag_au/review/w/wix-websit/wix-website-builder_tfca.jpg";
export const HUBSPOT_LOGO_URL =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScIJVcPOSNnU1SLd4KrWlMX-XEx7ChbGYspQ&s";
