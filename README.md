# Wix <> HubSpot Integration (Assignment)

Production-style Wix CLI integration that connects Wix and HubSpot for secure OAuth onboarding, configurable field mapping, reliable bi-directional contact sync, and Wix form-to-HubSpot lead capture with attribution.

## Submission Deliverables (Requirements 107-111)

### 1) APIs used per feature

| Feature | API / Integration | Purpose |
| --- | --- | --- |
| #1 Reliable bi-directional contact sync | Wix contact change triggers (webhook intake) | Receive Wix-origin contact create/update events for processing |
| #1 Reliable bi-directional contact sync | HubSpot CRM Contacts API | Search/create/update HubSpot contacts from mapped Wix payloads |
| #1 Reliable bi-directional contact sync | HubSpot CRM Properties API | Load and cache property metadata for mapping UI and validation |
| #1 Reliable bi-directional contact sync | HubSpot Webhooks API (`contact.propertyChange`) | Inbound HubSpot -> Wix contact updates without polling |
| #1 Reliable bi-directional contact sync | Wix Contacts API (v4) | Create/update Wix contacts for HubSpot-origin sync operations |
| #2 Form & lead capture | Wix form submission trigger -> backend endpoint | Capture Wix-native submissions as integration events |
| #2 Form & lead capture | HubSpot CRM Contacts API | Upsert lead/contact data in HubSpot within seconds |
| #2 Form & lead capture | Attribution persistence in app DB | Preserve UTM/source/page/referrer/timestamp for observability |

### 2) Working integration scope

- [x] Feature #1 implemented: reliable Wix <-> HubSpot contact sync with mapping, conflict rules, idempotency, and loop prevention.
- [x] Feature #2 implemented: Wix form submission -> HubSpot lead/contact upsert with attribution capture.

### 3) GitHub repository

- Repo URL: https://github.com/Jobsidney/app-market-wix-assignment/tree/Development

### 4) Test environments

| System | URL |
| --- | --- |
| Production backend | https://app-market-wix-assignment-production.up.railway.app |
| HubSpot portal | https://app-eu1.hubspot.com/contacts/148321192/objects/0-1/views/all/list |
| Wix dashboard | https://manage.wix.com/dashboard/f8758271-c14a-495a-9b70-4e4e35ab04f1/0bbfcbba-4105-4579-83ca-b5f0bb5ec2d1 |

- Production API: `https://app-market-wix-assignment-production.up.railway.app`
- HubSpot portal ID: `148321192`
- Wix site ID: `f8758271-c14a-495a-9b70-4e4e35ab04f1`
- Tester account email: `jobsid933@gmail.com`

## Stack

- Wix CLI app extensions (dashboard page under `src/extensions/dashboard/pages/my-page/dashboard/`: `use-dashboard-state`, layout, tokens, and `views/*` for SRP/DRY)
- Node.js + TypeScript + Express
- PostgreSQL (hosted on Railway)
- HubSpot OAuth + CRM Contacts API
- Deployed on Railway (production backend + DB)

## Evaluator Setup Guide (What to configure, where, and why)

Use this section if you are testing the project for the first time and need all required keys, URLs, and runtime wiring.

### A) Environment variables checklist

Copy the root `.env.example` to `.env` (this file lives at `app-market/.env`, not inside `server/`):

```bash
cp .env.example .env
```

Then fill in the required values:

```bash
# Required for backend boot
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<db>
ENCRYPTION_KEY=<32-byte-secret>
HUBSPOT_CLIENT_ID=<hubspot-app-client-id>
HUBSPOT_CLIENT_SECRET=<hubspot-app-client-secret>
HUBSPOT_REDIRECT_URI=http://localhost:8787/oauth/hubspot/callback
APP_INTERNAL_ID=<any-stable-string-like-app-market-sync>

# Recommended for production-like auth
WIX_APP_SECRET=<wix-app-secret-from-dev-center>

# Optional local/demo toggles
APP_MARKET_API_KEY=<optional-static-key>
WEBHOOK_HMAC_SECRET=<optional-hmac-secret>
WIX_AUTOMATION_WEBHOOK_KEY=<optional-automation-shared-key>
WIX_API_KEY=<optional-wix-contacts-api-token-for-hubspot-to-wix-create-update>
WIX_ACCOUNT_ID=<wix-account-id-decoded-from-WIX_API_KEY-jwt>
# WIX_CANONICAL_SITE_ID — DO NOT SET IN PRODUCTION (dev/single-site only)
HUBSPOT_APP_ID=<optional-for-webhook-registration-script>
HUBSPOT_DEVELOPER_API_KEY=<optional-for-webhook-registration-script>
SYNC_SECURITY_MODE=standard
```

Copy the frontend env template:

```bash
PUBLIC_DEFAULT_WIX_SITE_ID=<optional-local-site-id-fallback>
PUBLIC_APP_MARKET_API_KEY=<optional-if-using-APP_MARKET_API_KEY>
# For local development:
PUBLIC_API_BASE_URL=http://localhost:8787
# For production build (must match your deployed backend URL — baked into frontend at build time):
# PUBLIC_API_BASE_URL=https://app-market-wix-assignment-production.up.railway.app
```

> **Important for production builds:** `PUBLIC_API_BASE_URL` is embedded into the frontend bundle at build time by Vite. Railway env vars do **not** override it. Before running `npm run build && npm run release`, make sure this is set to your production backend URL in the local `.env` file.

### B) Where each key comes from

**`HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET`**
Go to your [HubSpot developer account](https://developers.hubspot.com), open your app, and click the **Auth** tab. Copy the Client ID and Client Secret shown there.

**`HUBSPOT_REDIRECT_URI`**
The URL HubSpot sends the user back to after they approve the connection. Set it to:
```
https://<your-backend-domain>/oauth/hubspot/callback
```
Paste the same URL into your HubSpot app under **Auth → Redirect URLs** — they must match exactly.

**`WIX_APP_SECRET`**
Go to [Wix Dev Center](https://dev.wix.com), open your app, navigate to **OAuth → App Credentials**, and copy the **App Secret**.

**`DATABASE_URL`**
Your PostgreSQL connection string in the format `postgresql://user:password@host:5432/dbname`. If using Railway, copy it from your Postgres service's **Connect** tab.

**`ENCRYPTION_KEY`**
A random secret used to encrypt the HubSpot tokens stored in the database. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Keep this private — changing it after launch will invalidate all existing stored tokens.

**`HUBSPOT_APP_ID` and `HUBSPOT_DEVELOPER_API_KEY`**
Only needed if you want to register HubSpot webhooks via the CLI script (`npm run hubspot:register-webhooks`). Find the numeric App ID in your HubSpot developer app settings. The Developer API Key is under your HubSpot developer account → **Developer API key**.

**`WIX_API_KEY`**
Required for syncing contacts from HubSpot into Wix. Get it from [Wix Dev Center](https://dev.wix.com) under **API Keys**. The value starts with `IST.`.

**`WIX_ACCOUNT_ID`**
Your Wix **account** ID — this is different from your site ID even though both are UUIDs. Decode it from your `WIX_API_KEY` by running:
```bash
node -e "
  const key = 'PASTE_YOUR_WIX_API_KEY_HERE';
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
  console.log(JSON.parse(payload.data).tenant.id);
"
```
The printed UUID is your `WIX_ACCOUNT_ID`. Do not use your site ID here — Wix will reject the API call with a mismatch error.

**`WIX_CANONICAL_SITE_ID`**
> **WARNING: Do NOT set this in a production / Wix App Market deployment.**
> This variable forces every request to use a single hardcoded site ID, which breaks multi-tenant isolation — all users' data would be written to the same site bucket.
> Only set it in a local single-site dev environment where you want to override the site ID delivered by Wix.

### C) Run sequence (backend + app)

From project root:

```bash
npm install
npm run migrate:server
npm run dev:server
```

In another terminal:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{ "ok": true }
```

### D) OAuth wiring

1. Start app and open Wix dashboard extension.
2. Click connect; app calls `GET /connection/authorize-url`.
3. Complete HubSpot consent.
4. Backend callback: `GET /oauth/hubspot/callback`.
5. Verify: `GET /connection/status` -> connected `true`.

### E) Webhook URLs and external configuration

#### HubSpot -> backend webhook

- Endpoint: `POST /webhooks/hubspot/contact-updated`
- Public URL example:
  - `https://<your-public-host>/webhooks/hubspot/contact-updated`

In HubSpot developer app/webhooks:
- Configure contact change subscription (`contact.propertyChange`).
- Ensure your app/webhook base URL points to your public backend.

Optional CLI registration:

```bash
npm run hubspot:register-webhooks -- --wix-site-id=<your_wix_instance_id>
```

#### Wix -> backend contact webhook

- Endpoint: `POST /webhooks/wix/contact-updated`
- Production URL: `https://app-market-wix-assignment-production.up.railway.app/webhooks/wix/contact-updated`

**Primary (multi-tenant): Wix Dev Center app-level webhooks**

Configure in [Wix Dev Center](https://dev.wix.com) → your app → Webhooks → add a Contact Created/Updated webhook pointing to the endpoint above. Dev Center webhooks fire automatically for **every site** that installs the app — no per-site Automation setup needed. The webhook body includes the site's `instanceId` so the backend can route the event to the correct tenant.

Authentication for Dev Center webhooks: the backend verifies the `x-wix-signature` header (HMAC-SHA256 of raw body using `WIX_APP_SECRET`). No extra query params needed.

**Fallback (per-site): Wix Automations**

For sites using Wix Automations (Trigger: "Contact is created or updated" → Action: "Send HTTP request"):
- Wix Automations does **not** support custom headers in the HTTP request action.
- Pass `wixSiteId` and `wixKey` as **URL query parameters** instead:
  ```
  https://<host>/webhooks/wix/contact-updated?wixSiteId=<your-site-id>&wixKey=<WIX_AUTOMATION_WEBHOOK_KEY>
  ```
- The request body should be sent as JSON with the contact payload. The backend deep-scans the body for email, first name, last name, phone, and contact ID across many known Wix Automation payload shapes.

> **Why query params for Automations?** Wix Automations "Send HTTP request" only allows setting the URL and body — no custom header support. The `?wixKey=` query param is the supported fallback for `WIX_AUTOMATION_WEBHOOK_KEY` authentication.

#### Wix form -> backend lead capture

- Endpoint: `POST /forms/wix/submission`
- Public URL example:
  - `https://<your-public-host>/forms/wix/submission`

This powers Feature #2 (Wix form capture -> HubSpot upsert + attribution persistence).

### F) Security modes (important for evaluators)

- If `SYNC_SECURITY_MODE=locked`, backend requires secure settings and will fail fast if missing.
- If `WEBHOOK_HMAC_SECRET` is set, webhook/form endpoints require valid `x-sync-signature`.
- If `WIX_APP_SECRET` is set, dashboard and mapping routes expect signed Wix `instance` authorization context.
- `APP_MARKET_API_KEY` mode is available for local/demo fallback when full Wix auth context is not being used.

## Implemented Features

### 1) OAuth connection and secure token handling

- HubSpot OAuth 2.0 callback: `GET /oauth/hubspot/callback`
- Token storage in `oauth_installations`
- Refresh token and access token ciphertext at rest (AES-256-GCM; legacy plaintext access tokens still decode)
- Access token refresh before HubSpot API calls
- **Secret Manager–style deployment:** load `DATABASE_URL`, `ENCRYPTION_KEY`, and API client secrets from your platform’s secret store (GCP Secret Manager, AWS Secrets Manager, Kubernetes Secrets, etc.) into environment variables at process start—never commit them. At runtime, HubSpot tokens only exist decrypted in memory for outbound API calls.

### 2) Field mapping UI + persistence

- Wix dashboard page: `HubSpot Sync Center`
- Editable mapping table with:
  - Wix field path (dropdown from palette)
  - HubSpot property (dropdown populated from `GET /dashboard/hubspot/properties` when connected)
  - sync direction
  - transform rule (per-row dropdown: none, `trim`, `lowercase`, or both)
- Save/load mappings from `field_mappings`
- Duplicate HubSpot property validation on save
- Success and error messages in UI

### 3) Bi-directional sync pipeline

- **Persisted `field_mappings`** are loaded in the sync worker (not ad-hoc `fieldMapping` on webhook bodies). Direction and `trim` / `lowercase` transform rules apply per row.
- **Live / paused** per site: `GET /connection/sync-live`, `PATCH /connection/sync-live` with `{ "live": true|false }`. When paused, webhooks and form intake return `skipped: sync_paused`; the worker re-queues jobs without burning retry attempts until live again.
- Webhook ingestion endpoints:
  - `POST /webhooks/wix/contact-updated`
  - `POST /webhooks/hubspot/contact-updated`
- Optional HMAC on webhooks and form intake when `WEBHOOK_HMAC_SECRET` is set: send header `x-sync-signature` with lowercase hex HMAC-SHA256 of the **raw JSON body** using that secret (optional `sha256=` prefix supported).
- Wix Automations fallback (when HMAC is not available in Wix UI): set `WIX_AUTOMATION_WEBHOOK_KEY` and send it in one of these for `POST /webhooks/wix/contact-updated`: header `x-wix-automation-key`, body field `wixAutomationKey`, or URL query `?wixKey=...`.
- Fast `200` webhook ack; processing happens async through `sync_jobs` queue worker
- Loop prevention:
  - ignore internal correlation ids (`APP_INTERNAL_ID-*`)
- Idempotency:
  - deep compare and skip no-op writes
- Conflict rule:
  - `last-updated-wins` (older event is skipped)
- External id mapping in `sync_mapping` (lookup by Wix id or HubSpot id for inbound events)
- **HubSpot → Wix create:** when a HubSpot event includes `hubspotContactId` but no `wixContactId`, and `WIX_API_KEY` is set, the worker creates a Wix contact via Contacts v4 **POST** (requires mapped name, email, or phone). Updates still use **GET** + **PATCH** when `wixContactId` is known.

### 4) Form capture with attribution

- Assignment allows either embedded HubSpot forms or Wix-native forms; this repo implements **Wix form submission → HubSpot** and **Path A persistence**: dashboard **Save embed settings** stores portal ID + form GUID + region per site (`hubspot_embed_settings`), with `GET /connection/hubspot-embed` and `PUT /connection/hubspot-embed`, plus a generated embed snippet.
- Endpoint: `POST /forms/wix/submission`
- Stores event metadata in `form_submission_events`:
  - UTM source/medium/campaign/term/content
  - page URL
  - referrer
  - payload snapshot
- HubSpot upsert uses the same persisted mappings (`wix_to_hubspot` / `bidirectional`) when present, with a small hard-coded fallback when no rows match flat form payloads

## API Plan (Deliverable A)

### Feature #1: Contact sync

- Wix contact update/create triggers:
  - consumed as webhook events in backend
- HubSpot Contacts API:
  - `crm.contacts.search` by email
  - `crm.contacts.create`
  - `crm.contacts.update`
- HubSpot Properties API:
  - cached metadata for property filtering (1 hour)
- HubSpot -> Wix:
  - worker resolves `wixContactId` from the event, from `sync_mapping` by HubSpot id, or creates a contact with **POST** when only HubSpot id is present (with `WIX_API_KEY` + `wix-site-id`); updates use **GET** + **PATCH**; `wix_contacts_shadow` is updated for observability

### Feature #2: Form/lead capture

- Wix form submission trigger:
  - `POST /forms/wix/submission`
- Persist attribution metadata to DB for observability
- Upsert contact into HubSpot with available mapped properties
- Default fallback (when no DB mappings match) sends standard contact fields plus UTM keys as HubSpot properties: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (create these as single-line text properties in HubSpot if missing)

## Data Model

- `oauth_installations` — per-site HubSpot OAuth tokens + portal ID + `wix_meta_site_id` (resolved from instance JWT at OAuth time)
- `site_meta` — maps `wix_site_id` (instanceId) → `wix_meta_site_id` for sites installed via APP_INSTALLED lifecycle event
- `field_mappings` — per-site field mapping rules (direction, transform)
- `sync_definitions` — per-site sync configuration (entity types, direction, existing-record policy, `live` flag)
- `sync_mapping` — bidirectional Wix↔HubSpot contact ID mapping, scoped per `wix_site_id`
- `sync_jobs` — async job queue for sync events (status: `queued → processing → done/failed`)
- `site_sync_state` — per-site global sync on/off toggle
- `form_submission_events` — form capture attribution data (UTMs, page URL, referrer)
- `wix_contacts_shadow` — local shadow of Wix contacts for inbound HubSpot sync observability
- `hubspot_embed_settings` — saved HubSpot form embed config (portal, form GUID, region)

## Local Run

### Evaluator quickstart (recommended)

All commands run from the `app-market/` directory.

1. Copy env templates:
   ```bash
   cp .env.example .env
   cp .env.local.example .env.local
   ```
   > Both `.env` files live at the root `app-market/` level — **not** inside `server/`. The backend reads `.env` from the working directory when started with `npm run dev:server`.
2. Fill required values in `.env`:
   - `DATABASE_URL` — local Postgres connection string (create a DB first: `createdb app_market`)
   - `ENCRYPTION_KEY` — any 32+ character random string
   - `HUBSPOT_CLIENT_ID` + `HUBSPOT_CLIENT_SECRET` — from HubSpot developer app → Auth tab
   - `HUBSPOT_REDIRECT_URI=http://localhost:8787/oauth/hubspot/callback`
3. Pick one auth mode:
   - **Recommended:** set `WIX_APP_SECRET` (from Wix Dev Center → your app → OAuth → App secret)
   - **Fallback/demo:** leave `WIX_APP_SECRET` empty and set `APP_MARKET_API_KEY` (+ `PUBLIC_APP_MARKET_API_KEY` in `.env.local`)
4. Run:
   ```bash
   npm install
   npm run migrate:server
   npm run dev:server   # starts backend on port 8787
   npm run dev          # starts Wix CLI app (requires Wix account)
   ```

### Full environment reference

1. Install dependencies:
   - `npm install`
2. Environment:
   - Server `.env`: `DATABASE_URL`, `ENCRYPTION_KEY`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI=http://localhost:8787/oauth/hubspot/callback`, `APP_INTERNAL_ID`
   - **Recommended (production): `WIX_APP_SECRET`** — copy the **App secret** from your app’s [OAuth settings](https://manage.wix.com/app-selector) in the Wix dashboard. When set, `/dashboard/*`, `/mappings/*`, and `/connection/*` require the dashboard to send the signed app instance in the `Authorization` header (the Wix CLI dashboard iframe provides this as the `instance` query param; the UI reads it automatically). The decoded **`instanceId` is your tenant key** (`wix_site_id` in Postgres, OAuth `state`, and HubSpot token row). Re-connect HubSpot once after switching from a demo `x-wix-site-id` so tokens are stored under the real `instanceId`.
   - Optional server: `APP_MARKET_API_KEY` — when set and **`WIX_APP_SECRET` is unset**, the same routes also require `x-app-market-key` (legacy demo mode).
   - Optional server: `WEBHOOK_HMAC_SECRET` — when set, `/webhooks/*` and `/forms/*` require valid `x-sync-signature` (see sync section).
   - Optional server: `WIX_AUTOMATION_WEBHOOK_KEY` — static shared secret for Wix Automations calls to `/webhooks/wix/contact-updated` via header `x-wix-automation-key`, body `wixAutomationKey`, or query `wixKey`.
   - Optional server: `WIX_API_KEY` — `Authorization` header value for Wix Contacts v4 (HubSpot → Wix). Without it, inbound sync still updates `wix_contacts_shadow` only.
   - Optional server: `WIX_ACCOUNT_ID` — Wix account ID extracted from the `WIX_API_KEY` JWT (see B above). If omitted the server attempts to derive it automatically from the key, but setting it explicitly is more reliable.
   - Optional server: `WIX_CANONICAL_SITE_ID` — **do NOT set in production**. Dev-only override that forces a single hardcoded site ID; breaks multi-tenant isolation if set on the App Market deployment.
   - Optional (CLI only): `HUBSPOT_APP_ID`, `HUBSPOT_DEVELOPER_API_KEY` — for `npm run hubspot:register-webhooks` (see **HubSpot webhooks**).
   - Optional Wix / Vite: `PUBLIC_DEFAULT_WIX_SITE_ID` — only used when **`WIX_APP_SECRET` is not set** on the server (local dev); sends `x-wix-site-id` (defaults to `demo-site`).
   - Optional Wix / Vite: `PUBLIC_APP_MARKET_API_KEY` — only if you use `APP_MARKET_API_KEY` without `WIX_APP_SECRET`.
   - Optional Wix / Vite: `PUBLIC_API_BASE_URL` — override API URL for frontend; defaults to `http://localhost:8787` on localhost.
   - **`SYNC_SECURITY_MODE=locked`:** server refuses to start unless `WEBHOOK_HMAC_SECRET` is set **and** at least one of `WIX_APP_SECRET` or `APP_MARKET_API_KEY` is set.
3. Run migration:
   - `npm run migrate:server`
4. Start backend:
   - `npm run dev:server`
5. Start Wix app:
   - `npm run dev`

## Verification Runbook (Deliverable B evidence)

- Health:
  - `GET /health` -> `{ "ok": true }`
- OAuth:
  - `GET /connection/authorize-url`
  - complete consent in browser
  - `GET /connection/status` -> connected true
- Mapping:
  - `PUT /mappings`, then `GET /mappings` (include `x-app-market-key` when `APP_MARKET_API_KEY` is set)
  - With HubSpot connected: `GET /dashboard/hubspot/properties` returns live contact property metadata
- Queue:
  - webhook/form POST returns `{ accepted: true }` (include `x-sync-signature` when `WEBHOOK_HMAC_SECRET` is set)
  - `sync_jobs` transitions to `done`
- Attribution:
  - check `form_submission_events` rows
- Dashboard with `WIX_APP_SECRET`:
  - Open the app from the Wix dashboard so `?instance=…` is present; API calls send `Authorization: <instance>` automatically.

## Credentials sourcing guide (for reviewers)

- **HubSpot OAuth credentials** (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`):
  - HubSpot developer account -> your app -> Auth tab.
- **Wix app secret** (`WIX_APP_SECRET`, recommended):
  - Wix Dev Center -> your app -> OAuth settings -> App secret.
- **Postgres connection** (`DATABASE_URL`):
  - Local Postgres instance or managed Postgres from your host.
- **Encryption secret** (`ENCRYPTION_KEY`):
  - Generate a random 32+ character value and keep it private.
- **Webhook security** (`WEBHOOK_HMAC_SECRET`, optional but recommended):
  - Shared secret between event sender and backend.

For submission, provide the reviewer with:
- a test environment or safe credentials,
- the GitHub repo URL,
- and a test user/account for connection validation.

## HubSpot webhooks

### Target URL and headers

Point HubSpot (or your reverse proxy) at your public API, for example `POST https://<your-host>/webhooks/hubspot/contact-updated`, with `Content-Type: application/json`, `x-wix-site-id: <your Wix instanceId>`, and `x-sync-signature` when `WEBHOOK_HMAC_SECRET` is set. The JSON body should carry contact fields HubSpot sends plus optional `wixContactId` / `hubspotContactId` for the worker.

### Optional: register `contact.propertyChange` via CLI

HubSpot’s **Webhooks v3** `subscriptions` API is easiest with a **developer API key** (from the same HubSpot developer project as your app).

1. Set **`HUBSPOT_APP_ID`** to your app’s **numeric** ID (developer project → app).
2. Set **`HUBSPOT_DEVELOPER_API_KEY`** (recommended), or rely on an existing OAuth row for **`--wix-site-id=<instanceId>`** if HubSpot accepts your portal token (varies by account).
3. Run:

```bash
npm run hubspot:register-webhooks -- --wix-site-id=<your_wix_instance_id>
```

This creates two active subscriptions: **`contact.creation`** (fires when any new contact is created, regardless of which properties are set) and **`contact.propertyChange`** (fires on field-level changes). Your app’s **webhook target URL** must still match what HubSpot expects for that app (configured in the HubSpot developer UI under the app’s webhook base URL).

## Wix → backend contact events (Automations / HTTP)

To trigger **`POST /webhooks/wix/contact-updated`** from Wix when a contact changes, use **Wix Automations** with a "Contact is created or updated" trigger and an **HTTP request** action.

### Working configuration

Because Wix Automations does not support custom headers in the HTTP action, authentication and site ID must be passed as query parameters:

```
POST https://<host>/webhooks/wix/contact-updated?wixSiteId=<site-id>&wixKey=<WIX_AUTOMATION_WEBHOOK_KEY>
```

Leave the request body as the default full Wix event payload. The backend extracts contact fields (email, first name, last name, phone, contact ID) automatically from the nested Wix event structure.

### Authentication options (any one is sufficient)

| Method | How to pass |
| --- | --- |
| HMAC signature | `x-sync-signature` header (HMAC-SHA256 of raw body using `WEBHOOK_HMAC_SECRET`) |
| Automation key | `x-wix-automation-key` header, OR `wixAutomationKey` body field, OR `?wixKey=` query param |

### Custom body params (optional override)

If you want explicit control over what's synced, you can send a custom JSON body:

```json
{
  "wixContactId": "{{contact id}}",
  "email": "{{contact email}}",
  "firstName": "{{contact first name}}",
  "lastName": "{{contact last name}}"
}
```

Variable tokens like `{{contact id}}` are resolved by Wix Automations at runtime.

## Production Deployment (Railway)

The backend is deployed on Railway at `https://app-market-wix-assignment-production.up.railway.app`.

### Backend deploy

Railway automatically deploys from the connected git branch on push. Required env vars (set in Railway):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Railway Postgres connection string |
| `ENCRYPTION_KEY` | Token encryption key (32+ chars) |
| `HUBSPOT_CLIENT_ID` | HubSpot app client ID |
| `HUBSPOT_CLIENT_SECRET` | HubSpot app client secret |
| `HUBSPOT_REDIRECT_URI` | `https://app-market-wix-assignment-production.up.railway.app/oauth/hubspot/callback` |
| `WIX_API_KEY` | Wix app-level API key (IST token) |
| `WIX_ACCOUNT_ID` | Decoded from WIX_API_KEY JWT |
| `WIX_APP_SECRET` | Wix app secret from Dev Center |
| `WIX_AUTOMATION_WEBHOOK_KEY` | Shared key for Wix Automation webhook auth |
| `WEBHOOK_HMAC_SECRET` | HMAC secret for webhook signature verification |
| `HUBSPOT_APP_ID` | HubSpot app numeric ID |
| `SYNC_SECURITY_MODE` | Set to `standard` or `locked` |

> **Do NOT set `WIX_CANONICAL_SITE_ID` in production.** This env var is a local dev override that forces a single hardcoded site ID, breaking multi-tenant isolation.

### Frontend deploy (Wix extension)

The frontend is a Wix CLI extension. It is **not** deployed to Railway — it runs inside the Wix platform as an app version.

To deploy a new frontend version:

1. Ensure `PUBLIC_API_BASE_URL` in root `.env` points to the production Railway URL (not localhost)
2. From the `app-market/` directory:
   ```bash
   npm run build && npm run release
   ```
   > `npm run release` requires an interactive terminal (TTY). Run it directly in your terminal, not via a script runner.
3. In the Wix Dev Center, publish the new app version
4. Sites that have the app installed will receive the update

### App installation (multi-tenant)

Each Wix site owner installs the app through the official Wix App Market install URL. After installation:
- Their site ID is registered with the app via Wix OAuth/lifecycle events
- They connect their own HubSpot account through the in-app OAuth flow
- All data (sync definitions, field mappings, contacts, tokens) is isolated per `wix_site_id`

> Sites that were added manually to the database (not via the official install flow) may receive `meta-site not found` errors from the Wix Contacts API. Use the official install URL to properly register a site.

### App lifecycle endpoint

`POST /lifecycle/wix` — Wix sends APP_REMOVED lifecycle events here (signed with `WIX_APP_SECRET`). On removal, all data for that site is deleted from every table. Configure this URL in the Wix Dev Center under your app's lifecycle webhook settings.

## Notes / Current Constraints

- HubSpot API writes are implemented for Wix → HubSpot sync and form capture.
- HubSpot → Wix: with `WIX_API_KEY`, inbound events can **create** a Wix contact when only `hubspotContactId` is supplied (mapped payload must include at least one of name, email, or phone), or **update** when `wixContactId` is known (or resolved via `sync_mapping`). Standard `ContactInfo` fields are supported; arbitrary Wix extended/custom fields from HubSpot are not expanded in this sample.
- Request logs redact `Authorization`, `x-app-market-key`, and `x-sync-signature` headers where supported by the logger configuration.

## Local Public Testing with ngrok (Recommended for Evaluators)

When HubSpot or Wix needs to call your local backend, expose port `8787` over HTTPS using ngrok.

### 1) Start backend and open ngrok tunnel

Terminal A:

```bash
npm run dev:server
```

Terminal B:

```bash
ngrok http 8787
```

Copy the generated HTTPS forwarding URL, for example:

```text
https://abc12345.ngrok-free.app
```

### 2) Update environment values that must use the public URL

In `server/.env`:

```bash
HUBSPOT_REDIRECT_URI=https://abc12345.ngrok-free.app/oauth/hubspot/callback
```

In root `.env` (frontend):

```bash
PUBLIC_API_BASE_URL=https://abc12345.ngrok-free.app
```

Restart both processes after changing env files:

```bash
# terminal A
npm run dev:server

# terminal C
npm run dev
```

### 3) Configure external webhook targets with ngrok URL

Set webhook targets to:

- HubSpot contact webhook:
  - `https://abc12345.ngrok-free.app/webhooks/hubspot/contact-updated`
- Wix contact automation webhook:
  - `https://abc12345.ngrok-free.app/webhooks/wix/contact-updated`
- Wix form submission webhook:
  - `https://abc12345.ngrok-free.app/forms/wix/submission`

### 4) HubSpot app configuration checks

In your HubSpot developer app:

- Add the ngrok callback URL to allowed redirect URLs:
  - `https://abc12345.ngrok-free.app/oauth/hubspot/callback`
- Ensure webhook subscriptions include both `contact.creation` and `contact.propertyChange` (run `npm run hubspot:register-webhooks` to register both).
- Ensure webhook base/target points to your ngrok host.

### 5) Wix automation configuration checks

In Wix Automations HTTP action:

- URL uses ngrok endpoint (`/webhooks/wix/contact-updated`).
- Include `wixSiteId`.
- If using automation key mode, include one:
  - header: `x-wix-automation-key`
  - or body field: `wixAutomationKey`
  - or query parameter: `?wixKey=...`

### 6) HMAC mode (if enabled)

If `WEBHOOK_HMAC_SECRET` is set, external webhook/form callers must send:

- header: `x-sync-signature`
- value: HMAC-SHA256 over raw JSON body (hex, optional `sha256=` prefix)

### 7) Reconnection note

If you change ngrok URL, you must:

1. Update `HUBSPOT_REDIRECT_URI`
2. Update `PUBLIC_API_BASE_URL`
3. Update HubSpot redirect + webhook URLs
4. Update Wix automation endpoint URLs
5. Re-run OAuth connect flow from dashboard
