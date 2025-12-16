## Telemetry (Vercel Web Analytics)

This app uses **Vercel Web Analytics custom events** to understand user behavior and operational health without impacting UX.

### Where telemetry lives

- **Client-side wrapper**: `lib/telemetry.ts`
  - Use `trackEvent(name, data?)` in client components.
  - Enforces Vercel custom event constraints (flat, primitive values), truncation, and **never throws**.
- **Server-side wrapper**: `lib/telemetry-server.ts`
  - Use `await trackServerEvent(name, data?)` in API routes / server actions.
  - Same payload safety guarantees and **never throws**.
- **Geo extraction helper**: `lib/geo-context.ts`
  - Shared logic to extract `{ geo_country, geo_region }` from a `NextRequest` (`request.geo` + Vercel headers fallback).
- **Geo bootstrap**: `middleware.ts`
  - For **HTML document navigations only**, sets `geo_country` / `geo_region` cookies (24h TTL) so client events can include geo context.
  - Only sets cookies when values are **missing or changed** (avoids repeated `Set-Cookie` on every navigation).

### Event naming

- **Format**: `snake_case`
- **Examples**:
  - `wallet_view`
  - `marketplace_deposit_tx_submitted`
  - `api_newsletter_subscribe_success`

### Payload rules (important)

Vercel custom event properties should be **flat** and **primitive**.

- **Allowed values**: `string | number | boolean | null`
- **Not allowed**: nested objects / arrays (the wrapper will stringify them, but don’t rely on that)
- **Key/value length**: truncated to 255 chars
- **Do not send PII**: no emails; no IP; avoid full wallet addresses unless explicitly approved
- **Tx hash**: allowed (we use `tx_hash` where it already exists in-memory)

### Geo fields (where users are located)

We attach coarse geo to telemetry:

- **`geo_country`**: country code (e.g. `US`, `CA`)
- **`geo_region`**: region code (when available)

How it works:

- On Vercel, the edge/runtime provides geo information via headers and (optionally) `request.geo`.
- `middleware.ts` stores geo in cookies (`geo_country`, `geo_region`) with a 24h TTL **only for HTML document requests**, and only when missing/changed.
- `trackEvent(...)` automatically merges `{ geo_country, geo_region }` into every client event.
- Server-side events can add geo with `getGeoContextFromRequest(request)` (see `app/api/ens-names/route.ts`, `app/api/newsletter/route.ts`).

Local dev note: geo headers won’t exist locally, so geo fields may be `null` / absent.

### Instrumented areas (high level)

- **Marketplace**
  - `app/marketplace/deposit-dialog.tsx`: deposit funnel + tx lifecycle
  - `app/marketplace/launchpad-view.tsx`: filters + CTAs + stats opens
- **Buy flows**
  - `app/buy/view.tsx`: swap intent/result + dialog opens + smart-account blocks
  - `components/dialogs/buy-glow-dialog.tsx`: dialog funnel (open/close/submit/step results/success/error)
- **Wallet**
  - `app/wallet/view.tsx`: wallet page, dialogs, newsletter, key CTAs
  - `app/wallet/claims-panel.tsx`: claims funnel + stage updates + claim-all
- **API routes**
  - `app/api/ens-names/route.ts`, `app/api/newsletter/route.ts`: request/success/error + duration + geo

### How to add a new event

1. Pick an existing prefix (e.g. `wallet_`, `buy_`, `marketplace_`, `api_`) and create a **snake_case** name.
2. Add the call at the **user-action boundary** (click/submit) or **outcome boundary** (success/error), not in render loops.
3. Keep payload **flat** and **non-PII**; include a stable `stage` string for failures.
4. Use wrappers:
   - Client: `import { trackEvent } from "@/lib/telemetry";`
   - Server: `import { trackServerEvent } from "@/lib/telemetry-server";`

### Viewing events in Vercel

In Vercel dashboard:

- Project → **Analytics** → **Web Analytics** → **Events** (Custom Events)

Custom event properties appear as filters/dimensions (including `geo_country` / `geo_region`).
