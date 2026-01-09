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
  - `app/marketplace/deposit-dialog.tsx`: deposit funnel + tx lifecycle + success/error + share on X click
    - `marketplace_deposit_success`: purchase/delegation completed successfully
      - props: `currency`, `payment_method`, `listing_type`, `application_id`, `fraction_id`, `quantity`, `tx_hash`, `farm_name`, `zone_name`
    - `marketplace_deposit_error`: purchase/delegation failed (not tracked for user rejections)
      - props: `currency`, `payment_method`, `listing_type`, `application_id`, `fraction_id`, `quantity`, `failed_step`, `error_message`
    - `marketplace_deposit_share_x_click`: user clicked Share on X after success
      - props: `currency`, `application_id`, `fraction_id`, `steps_to_buy`, `tx_hash`
  - `app/marketplace/launchpad-view.tsx`: filters + CTAs + stats opens
- **Buy flows**
  - `app/buy/view.tsx`: swap intent/result + dialog opens + smart-account blocks
  - `components/dialogs/buy-glow-dialog.tsx`: dialog funnel (open/close/submit/step results/success/error)
- **Home / Dashboard (Bento)**
  - `app/page.tsx`: dashboard entrypoint on `/`
  - `app/test/bento.tsx`: dashboard composition + dialogs
  - `app/test/widgets/*`: dashboard widgets
  - `app/wallet/claims-panel.tsx`: claims funnel (re-used inside dashboard widgets)
- **API routes**
  - `app/api/ens-names/route.ts`, `app/api/newsletter/route.ts`: request/success/error + duration + geo

### Actions to track (Dashboard / Bento)

This section is the **concrete event catalog** for the Bento dashboard (`app/test/bento.tsx` + `app/test/widgets/*`).

#### Shared properties

Most dashboard events should include:

- **`source`**: where the action originated (e.g. `onboarding_hero_widget`, `quick_actions_widget`)
- **`wallet_connected`**: `boolean`
- **`wallet_address`**: **raw wallet address (lowercased)** when available; otherwise `null`
  - Explicitly approved for this dashboard telemetry (see PII note above).
- **`chain_id`**: optional number (when readily available)

#### Amount bucketing (no exact amounts)

For any “amount”-like telemetry, only send **bucket strings**:

- **Stablecoins (USDC/USDG)**: `amount_usd_bucket`
  - `0-25`, `25-100`, `100-250`, `250-1000`, `1000+`
- **ETH**: `amount_eth_bucket`
  - `0-0.01`, `0.01-0.1`, `0.1-1`, `1+`
- **Tokens (GLW/GCTL/etc.)**: `amount_token_bucket`
  - `0-10`, `10-100`, `100-1000`, `1000+`

#### Event catalog

All events below follow `snake_case` and use `dashboard_*` (dashboard surface area) or `gctl_*` (protocol action) prefixes.

- **Dashboard**
  - `dashboard_view`: Bento dashboard rendered
    - emitted by: `app/test/bento.tsx`

- **Onboarding (disconnected state)**
  - `dashboard_connect_wallet_click`: user clicked connect wallet
    - emitted by: `app/test/widgets/onboarding-hero-widget.tsx`
  - `dashboard_buy_glw_click`: user clicked buy GLW (opens Buy GLW dialog)
    - emitted by: `app/test/widgets/onboarding-hero-widget.tsx`

- **Quick actions**
  - `dashboard_buy_glw_click`: user clicked buy GLW tile
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`
  - `dashboard_launchpad_open_click`: user clicked launchpad tile (opens launchpad dialog)
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`
    - props: `launchpad_mode` (`delegations|miners`)
  - `dashboard_add_liquidity_open_click`: user clicked add liquidity tile
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`
    - props: `pair` (`glw_usdg`)
  - `dashboard_gctl_mint_stake_open_click`: user clicked stake GCTL tile (opens mint/stake dialog)
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`

- **Launchpad widget**
  - `dashboard_launchpad_tab_change`: changed tabs in launchpad widget (all/delegations/miners/activity)
    - emitted by: `app/test/widgets/launchpad-status-widget.tsx`
    - props: `tab`
  - `dashboard_launchpad_deposit_open_click`: clicked deposit CTA in widget (opens deposit dialog)
    - emitted by: `app/test/widgets/launchpad-status-widget.tsx`
    - props: `application_id`, `listing_type` (`miners|delegations`), `payment_currency` (`USDC|GLW`)

- **Portfolio / net worth**
  - `dashboard_swap_open_click`: opens swap dialog
    - emitted by: `app/test/widgets/portfolio-allocation.tsx`, `app/test/widgets/net-worth.tsx`
    - props: optional `cta` (`swap_tokens|swap_for_glw`)
  - `dashboard_send_open_click`: opens send dialog
    - emitted by: `app/test/widgets/net-worth.tsx`

- **Impact + leaderboard**
  - `dashboard_impact_help_open_click`: opened “How Glow Impact Score works”
    - emitted by: `app/test/widgets/rank-widget.tsx`
    - props: `ui` (`tooltip|drawer`)
  - `dashboard_impact_breakdown_open_click`: opened Impact Score breakdown dialog
    - emitted by: `app/test/widgets/rank-widget.tsx`
  - `dashboard_leaderboard_open_click`: navigated to leaderboard (`/stats/rewards`)
    - emitted by: `app/test/widgets/rank-widget.tsx`, `app/test/widgets/global-leaderboard-widget.tsx`

- **Rewards**
  - `dashboard_rewards_claim_open_click`: opened rewards claim dialog
    - emitted by: `app/test/widgets/rewards-widget.tsx`
  - Claim lifecycle is instrumented in: `app/wallet/claims-panel.tsx` (`wallet_claim_*`)

- **Education**
  - `dashboard_education_click`: clicked an educational outbound link
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`, `app/test/widgets/gctl-heatmap-widget.tsx`
    - props: `topic` (`mining|delegation|gctl`), optional `url`

- **Mining (solar farm widget)**
  - `dashboard_mining_details_open_click`: opened mining performance details dialog
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`
  - `dashboard_mining_launchpad_open_click`: clicked “Browse Launchpad” from mining empty state
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`
  - `dashboard_mining_retry_click`: retry after mining widget error
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`
  - `dashboard_mining_filter_change`: changed filter in farms performance dialog (all/miners/delegations/other/in-progress)
    - emitted by: `app/test/widgets/farms-performance-dialog.tsx`
    - props: `filter`

- **FAQ**
  - `dashboard_faq_item_select`: selected an FAQ item
    - emitted by: `app/test/widgets/glow-faq-widget.tsx`
    - props: `faq_id`

- **Newsletter**
  - `dashboard_newsletter_subscribe_submit`: submitted newsletter form (client-side intent)
    - emitted by: `app/test/widgets/newsletter-widget.tsx`
  - `dashboard_newsletter_subscribe_success` / `dashboard_newsletter_subscribe_error`: client-side result (no email)
    - emitted by: `app/test/widgets/newsletter-widget.tsx`
    - props: `http_status` when available
  - Server-side outcomes are also instrumented in: `app/api/newsletter/route.ts` (`api_newsletter_*`)

- **Community**
  - `dashboard_discord_click`: clicked the Discord widget (outbound)
    - emitted by: `app/test/widgets/discord-widget.tsx`

- **Liquidity (GLW/USDG)**
  - `dashboard_add_liquidity_review_click`: clicked “Review/Add/…” in the quick add-liquidity dialog
  - `dashboard_add_liquidity_update_ratio_click`: clicked “Update ratio” warning action
  - `dashboard_add_liquidity_go_to_swap_click`: clicked “Go to Swap” (internal navigation to `/` — `/glow-swap` now redirects to `/`)
  - `dashboard_remove_liquidity_open_click`: clicked “Remove” (opens remove flow)
    - emitted by: `app/test/widgets/add-liquidity-quick-dialog.tsx`

- **GCTL mint & stake (key KPI)**
  - `gctl_mint_stake_dialog_open` / `gctl_mint_stake_dialog_close`
  - `gctl_mint_stake_submit` (props: `region_id`, `pay_currency`, `pay_amount_bucket`, `minted_gctl_bucket`)
  - `gctl_mint_stake_tx_sent` (props: `tx_hash`, plus the same bucketing props)
  - `gctl_mint_stake_error` (props: `error_message`, plus the same bucketing props)
    - emitted by: `components/dialogs/mint-and-stake-gctl-dialog.tsx`

#### Landing site (glow.org)

The marketing site has its own analytics integration (`@vercel/analytics/next` in `glow.org/app/layout.tsx`). We emit:

- `newsletter_subscribe_submit`
- `newsletter_subscribe_success`
- `newsletter_subscribe_error`

from `glow.org/components/sections/newsletter.tsx` with props `{ source: "glow_org_newsletter_section", variant }` and **never** the email address.

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
