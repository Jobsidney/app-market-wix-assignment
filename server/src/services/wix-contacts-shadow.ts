import { db } from "../lib/db.js";

export async function upsertWixContactShadow(
  wixSiteId: string,
  wixContactId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const email = typeof payload.email === "string" ? payload.email : null;
  const firstName = typeof payload.firstname === "string" ? payload.firstname : null;
  const lastName = typeof payload.lastname === "string" ? payload.lastname : null;

  await db.query(
    `insert into wix_contacts_shadow (wix_contact_id, wix_site_id, email, first_name, last_name, payload, updated_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, now())
     on conflict (wix_contact_id)
     do update set email = excluded.email,
                   first_name = excluded.first_name,
                   last_name = excluded.last_name,
                   payload = excluded.payload,
                   updated_at = now()`,
    [wixContactId, wixSiteId, email, firstName, lastName, JSON.stringify(payload)],
  );
  return wixContactId;
}
