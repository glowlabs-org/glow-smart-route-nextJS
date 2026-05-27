## Telemetry (Umami — self-hosted)

This app uses **Umami custom events** (self-hosted on Railway) to understand user behavior and operational health without impacting UX. Umami is privacy-focused, cookie-free, and gives the whole team dashboard access without a Vercel seat.

### Infrastructure

- **Instance**: `https://umami-production-c5d3.up.railway.app` (Railway project `shimmering-clarity` in ICRG workspace)
- **Website ID**: `80e6d736-7ef9-4ae8-9db0-b47cf730702d` (domain: `app.glow.org`)
- **Tracker script**: loaded in `app/layout.tsx`, gated to `NODE_ENV === "production"` so dev / preview builds don't pollute stats
- **Stack**: Umami + Postgres + Valkey (Redis), single replica in `us-east4-eqdc4a`

### Where telemetry lives

- **Client-side wrapper**: `lib/telemetry.ts`
  - Use `trackEvent(name, data?)` in client components.
  - Calls `window.umami.track(name, data)` when the tracker is loaded; silent no-op otherwise (dev, ad-blockers, preview deployments).
  - Applies Umami payload limits, truncation, and **never throws**.
- **Client-side identify**: `lib/telemetry.ts` → `identifyWallet(address, extra?)`
  - Associates the connected wallet with the current Umami session so backend joins can attribute events.
  - Fires from `lib/wallet-session-logger.ts` on every connect / address_change.
- **Server-side wrapper**: `lib/telemetry-server.ts`
  - Use `await trackServerEvent(name, data?, options?)` in API routes / server actions.
  - POSTs to Umami's `/api/send` endpoint with `{ type: "event", payload }`. Requires a non-empty `User-Agent` (Umami drops the event otherwise; we set one by default).
  - Uses `keepalive: true` so telemetry doesn't block the API response.
  - Configurable via `UMAMI_URL` and `UMAMI_WEBSITE_ID` env vars (default to production self-host).
- **Geo extraction helper**: `lib/geo-context.ts`
  - Shared logic to extract `{ geo_country, geo_region }` from a `NextRequest` (`request.geo` + Vercel headers fallback).
- **Geo bootstrap**: `middleware.ts`
  - For **HTML document navigations only**, sets `geo_country` / `geo_region` cookies (24h TTL) so client events include geo context as event properties.
  - Only sets cookies when values are **missing or changed** (avoids repeated `Set-Cookie` on every navigation).
  - Umami also derives its own session-level geo from IP. Our explicit `geo_country` / `geo_region` properties let us filter/segment events directly in the Events view, independent of session-level geo.

### Event naming

- **Format**: `snake_case`
- **Examples**:
  - `wallet_connected`
  - `marketplace_deposit_success`
  - `api_newsletter_subscribe_success`

### Payload rules (Umami constraints)

- **Allowed values**: `string | number | boolean | null`
- **Not allowed**: nested objects / arrays (the wrapper will stringify them, but don't rely on that)
- **String values**: truncated to 500 chars
- **Property keys**: truncated to 255 chars
- **Max properties**: 50 per event
- **Numbers**: up to 4 decimals of precision
- **Do not send PII**: no emails; no IP; avoid full wallet addresses unless explicitly approved
- **Tx hash**: allowed (we use `tx_hash` where it already exists in-memory)

### Geo fields (where users are located)

We attach coarse geo to every client event:

- **`geo_country`**: country code (e.g. `US`, `CA`, `KR`)
- **`geo_region`**: region code (when available)

How it works:

- On Vercel, the edge/runtime provides geo information via headers and (optionally) `request.geo`.
- `middleware.ts` stores geo in cookies (`geo_country`, `geo_region`) with a 24h TTL **only for HTML document requests**, and only when missing/changed.
- `trackEvent(...)` automatically merges `{ geo_country, geo_region }` into every client event.
- Server-side events can add geo with `getGeoContextFromRequest(request)` (see `app/api/newsletter/route.ts`).

Local dev note: geo headers won't exist locally, so geo fields may be `null` / absent. Umami itself is also disabled in dev (`NODE_ENV !== "production"` gate), so this is moot.

### Instrumented areas (high level)

- **Marketplace**
  - `app/marketplace/deposit-dialog.tsx`: deposit funnel + tx lifecycle + success/error + share on X click
    - `marketplace_deposit_success`: purchase/delegation completed successfully
      - props: `currency`, `payment_method`, `listing_type`, `delegation_source`, `delegation_id`, `application_id`, `fraction_id`, `quantity`, `tx_hash`, `farm_name`, `zone_name`
    - `marketplace_deposit_error`: purchase/delegation failed (not tracked for user rejections)
      - props: `currency`, `payment_method`, `listing_type`, `delegation_source`, `application_id`, `fraction_id`, `quantity`, `failed_step`, `error_message`
    - `marketplace_deposit_share_x_click`: user clicked Share on X after success
      - props: `currency`, `application_id`, `fraction_id`, `steps_to_buy`, `tx_hash`
    - `marketplace_deposit_share_native_click`: user shared success with the native share sheet
      - props: `currency`, `application_id`, `fraction_id`, `steps_to_buy`, `tx_hash`, `has_image`
  - `app/marketplace/launchpad-view.tsx`: filters + CTAs + stats opens
  - `app/marketplace/mining-center-view.tsx`: zone/sort filters (`mining_filter_change`)
- **Buy flows**
  - `app/buy/view.tsx`: swap intent/result + dialog opens + smart-account blocks
  - `components/dialogs/buy-glow-dialog.tsx`: dialog funnel (open/close/submit/step results/success/error)
- **Wallet**
  - `lib/wallet-session-logger.ts`: `wallet_connected` event + `identifyWallet(address)` on every connect/address_change
- **Home / Dashboard (Bento)**
  - `app/page.tsx`: dashboard entrypoint on `/`
  - `app/test/bento.tsx`: dashboard composition + dialogs
  - `app/test/widgets/*`: dashboard widgets
  - `app/wallet/claims-panel.tsx`: claims funnel (re-used inside dashboard widgets)
- **API routes**
  - `app/api/newsletter/route.ts`: request/success/error + duration + geo

### Actions to track (Dashboard / Bento)

This section is the **concrete event catalog** for the Bento dashboard (`app/test/bento.tsx` + `app/test/widgets/*`).

#### Shared properties

Most dashboard events should include:

- **`source`**: where the action originated (e.g. `onboarding_hero_widget`, `quick_actions_widget`)
- **`wallet_connected`**: `boolean`
- **`wallet_address`**: **raw wallet address (lowercased)** when available; otherwise `null`
  - Explicitly approved for this dashboard telemetry (see PII note above).
  - Also automatically tied to sessions via `identifyWallet()`, but included on events for explicit filtering.
- **`chain_id`**: optional number (when readily available)

#### Amount bucketing (no exact amounts)

For any "amount"-like telemetry, only send **bucket strings**:

- **Stablecoins (USDC/USDG)**: `amount_usd_bucket`
  - `0-25`, `25-100`, `100-250`, `250-1000`, `1000+`
- **ETH**: `amount_eth_bucket`
  - `0-0.01`, `0.01-0.1`, `0.1-1`, `1+`
- **Tokens (GLW/GCTL/etc.)**: `amount_token_bucket`
  - `0-10`, `10-100`, `100-1000`, `1000+`

#### Event catalog

All events below follow `snake_case` and use `dashboard_*` (dashboard surface area), `gctl_*` (GCTL protocol actions), `marketplace_*` (marketplace actions), or `wallet_*` (wallet actions) prefixes.

##### Priority Events (Core Conversions & Protocol Actions)

- **Newsletter subscription**

  - `dashboard_newsletter_subscribe_submit`: submitted newsletter form (client-side intent)
  - `dashboard_newsletter_subscribe_success`: subscription successful
  - `dashboard_newsletter_subscribe_error`: subscription failed
    - props: `source`, `wallet_connected`, `wallet_address`, `http_status` (when available)
    - emitted by: `app/test/widgets/newsletter-widget.tsx`
  - Server-side outcomes also tracked in: `app/api/newsletter/route.ts` (`api_newsletter_*`)

- **Community engagement**

  - `dashboard_discord_click`: clicked Discord widget banner
    - props: `source`, `wallet_connected`, `wallet_address`
    - emitted by: `app/test/widgets/discord-widget.tsx`

- **Wallet connection**

  - `wallet_connected`: initial wallet connection (fires once per address on first connect)
    - props: `chain_id`
    - emitted by: `lib/wallet-session-logger.ts`
  - Also: `identifyWallet(address, { chain_id })` is called on every connect/address_change to tie all subsequent events to the wallet.

- **GCTL minting & staking (key protocol KPI)**

  - `gctl_mint_stake_dialog_open` / `gctl_mint_stake_dialog_close`: dialog lifecycle
  - `gctl_mint_stake_submit`: user submitted mint & stake transaction
    - props: `step`, `region_id`, `pay_currency`, `pay_amount_bucket`, `minted_gctl_bucket`, `eth_pay_enabled`
  - `gctl_mint_stake_tx_sent`: transaction submitted to blockchain
    - props: `step`, `region_id`, `pay_currency`, `mint_currency`, `pay_amount_bucket`, `minted_gctl_bucket`, `tx_hash`
  - `gctl_mint_stake_error`: minting/staking failed
    - props: `step`, `region_id`, `pay_currency`, `pay_amount_bucket`, `minted_gctl_bucket`, `error_message`
  - `gctl_stake_existing_submit` / `gctl_stake_existing_success` / `gctl_stake_existing_error`: staking existing GCTL
    - props: `step`, `region_id`, `stake_amount_bucket`
    - emitted by: `components/dialogs/mint-and-stake-gctl-dialog.tsx`

- **Miner purchases & GLW delegations (marketplace)**
  - Includes SGCTL launchpad delegations. `delegation_source` is one of `staked`, `wallet_gctl`, `mint_usdc`, `mint_eth`.

  - `marketplace_deposit_success`: purchase or delegation completed
    - props: `currency`, `payment_method`, `listing_type` (`miners|delegations`), `delegation_source`, `delegation_id`, `application_id`, `fraction_id`, `quantity`, `tx_hash`, `farm_name`, `zone_name`
  - `marketplace_deposit_error`: purchase or delegation failed (not tracked for user rejections)
    - props: `currency`, `payment_method`, `listing_type`, `delegation_source`, `application_id`, `fraction_id`, `quantity`, `failed_step`, `error_message`
  - `marketplace_deposit_share_x_click`: user shared success on X
    - props: `currency`, `application_id`, `fraction_id`, `steps_to_buy`, `tx_hash`
  - `marketplace_deposit_share_native_click`: user shared success with native share
    - props: `currency`, `application_id`, `fraction_id`, `steps_to_buy`, `tx_hash`, `has_image`
    - emitted by: `app/marketplace/deposit-dialog.tsx`

- **GLW purchases (with source tracking)**

  - `buy_glw_dialog_open` / `buy_glw_dialog_close`: dialog lifecycle
  - `buy_glw_pay_token_change`: user changed payment token
    - props: `pay_token`, `source`
  - `buy_glw_submit_click`: user initiated purchase
    - props: `pay_token`, `pay_amount`, `usdc_balance`, `usdg_balance`, `has_bonding_step`, `source`
  - `buy_glw_step_result`: individual transaction step result
    - props: `step`, `ok`, `error_message` (if failed), `skipped` (if applicable), `source`
  - `buy_glw_success`: purchase completed
    - props: `pay_token`, `pay_amount`, `estimated_glw`, `has_bonding_step`, `source`
  - `buy_glw_error`: purchase failed
    - props: `error_message`, `source`
  - `buy_glw_connect_wallet_click`: connect wallet CTA clicked
    - props: `location` (`dialog_max|dialog_footer`), `source`
  - `buy_glw_max_click`: "max" button clicked
    - props: `pay_token`, `pay_balance`, `source`
    - emitted by: `components/dialogs/buy-glow-dialog.tsx`

- **Reward claiming**
  - `wallet_claim_week_click`: user clicked claim button for specific week
  - `wallet_claim_week_blocked`: claim blocked (reasons: `not_connected|no_proof|no_rewards`)
  - `wallet_claim_dialog_open` / `wallet_claim_dialog_close`: claim dialog lifecycle
  - `wallet_claim_confirm_click`: user confirmed claim in dialog
  - `wallet_claim_blocked`: claim blocked (reason: `smart_account`)
  - `wallet_claim_processing_start`: claim processing started
  - `wallet_claim_stage_update`: individual stage update (inflation/protocolDeposits)
  - `wallet_claim_tx_submitted`: transaction submitted
  - `wallet_claim_result`: final claim result (success/error/partial_error/exception/skipped)
  - `wallet_claim_single_reward_click` / `wallet_claim_single_reward_result`: individual reward claiming
    - emitted by: `app/wallet/claims-panel.tsx`

##### Dashboard & Widget Interactions

- **Dashboard view**

  - `dashboard_view`: Bento dashboard rendered
    - props: `source` (`bento`), `wallet_connected`, `wallet_address`
    - emitted by: `app/test/bento.tsx`

- **Buy GLW entry points (with source tracking)**

  - `dashboard_buy_glw_click`: user clicked "Buy GLW" button
    - props: `source` (e.g. `onboarding_hero_widget`, `launchpad_status_widget`, `rank_widget`), `wallet_connected`, `wallet_address`
    - emitted by: `app/test/widgets/onboarding-hero-widget.tsx`, `app/test/widgets/launchpad-status-widget.tsx`, `app/test/widgets/rank-widget.tsx`

- **GCTL entry points (with source tracking)**

  - `dashboard_gctl_mint_stake_open_click`: user clicked "Mint & Stake GCTL" button
    - props: `source` (e.g. `quick_actions_widget`, `rank_widget`, `gctl_heatmap_widget`), `wallet_connected`, `wallet_address`, optional `cta` (`link` for rank widget link)
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`, `app/test/widgets/rank-widget.tsx`, `app/test/widgets/gctl-heatmap-widget.tsx`

- **Impact & Leaderboard**

  - `dashboard_impact_help_open_click`: opened "How Glow Points work"
    - props: `source`, `wallet_connected`, `wallet_address`, `ui` (`tooltip|drawer`)
  - `dashboard_impact_indicator_click`: clicked individual impact indicator
    - props: `source`, `wallet_connected`, `wallet_address`, `indicator` (`miner|streak|steering|vault|emissions|worth`)
  - `dashboard_impact_breakdown_open_click`: opened points breakdown dialog
    - props: `source`, `wallet_connected`, `wallet_address`
  - `dashboard_breakdown_cta_click`: clicked CTA within points breakdown dialog
    - props: `source`, `wallet_connected`, `wallet_address`, `cta_type` (`steering|emissions|delegation|glow_worth|miner_bonus|streak`)
  - `dashboard_leaderboard_open_click`: navigated to leaderboard
    - props: `source`, `wallet_connected`, `wallet_address`
    - emitted by: `app/test/widgets/rank-widget.tsx`, `components/dialogs/impact-score-breakdown-dialog.tsx`

- **Portfolio & Net Worth**

  - `dashboard_glow_worth_breakdown_open_click`: opened Glow Worth breakdown dialog
    - props: `source`, `wallet_connected`, `wallet_address`, `chain_id`
    - emitted by: `app/test/widgets/net-worth.tsx`
  - `dashboard_swap_open_click`: opened swap dialog
    - props: `source`, `wallet_connected`, `wallet_address`, `chain_id`, optional `cta`
  - `dashboard_send_open_click`: opened send dialog
    - props: `source`, `wallet_connected`, `wallet_address`, `chain_id`
    - emitted by: `app/test/widgets/wallet-widget.tsx`

- **Blog & FAQ**

  - `dashboard_blog_click`: clicked featured blog post
    - props: `source`, `wallet_connected`, `wallet_address`, `article_slug`, `article_url`
    - emitted by: `app/test/widgets/blog-featured-widget.tsx`
  - `dashboard_faq_item_select`: selected FAQ item
    - props: `source`, `wallet_connected`, `wallet_address`, `faq_id`
    - emitted by: `app/test/widgets/glow-faq-widget.tsx`

- **Launchpad widget & view**

  - `dashboard_launchpad_tab_change`: changed tabs in launchpad widget
    - props: `source`, `wallet_connected`, `wallet_address`, `tab` (`all|delegations|miners|activity`)
    - emitted by: `app/test/widgets/launchpad-status-widget.tsx`
  - `marketplace_launchpad_filter_change`: changed filter in launchpad view
    - props: `filter` (`zone|type`), `value`
  - `marketplace_launchpad_pay_click`: clicked "Buy Miners" or "Delegate GLW" button
    - props: `application_id`, `app_type` (`miners|delegations`), `zone_id`
  - `marketplace_launchpad_advanced_stats_open`: opened advanced stats dialog
    - props: `application_id`, `app_type`, `zone_id`
    - emitted by: `app/marketplace/launchpad-view.tsx`

- **Mining (solar farm widget + mining-center)**

  - `dashboard_mining_details_open_click`: opened mining performance details dialog
    - props: `source`, `wallet_connected`, `wallet_address`, `cta` (`view_details|stats_block`)
  - `dashboard_mining_launchpad_open_click`: clicked "Browse Launchpad"
    - props: `source`, `wallet_connected`, `wallet_address`
  - `dashboard_mining_retry_click`: retry after error
    - props: `source`, `wallet_connected`, `wallet_address`
  - `dashboard_mining_filter_change`: changed filter in farms performance dialog
    - props: `filter` (`all|miners|delegations|other|in-progress`)
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`
  - `mining_filter_change`: changed filter on the mining-center listing page
    - props: `filter_type` (`zone|sort|sort_order`), `filter_value`
    - emitted by: `app/marketplace/mining-center-view.tsx`

- **My Farms**

  - `dashboard_my_farm_click`: clicked on a farm card/row
    - props: `source`, `wallet_connected`, `wallet_address`, `farm_id`, `farm_type` (`miner|delegation|other|in-progress`)
  - `dashboard_my_farms_sort_change`: changed sort order
    - props: `source`, `wallet_connected`, `wallet_address`, `sort_by` (`default|alphabetical|size|date`)
  - `dashboard_my_farms_view_change`: changed view mode
    - props: `source`, `wallet_connected`, `wallet_address`, `view_mode` (`default|grid|list`)
    - emitted by: `app/test/widgets/my-farms-grid-section.tsx`

- **Solar Collector (Impact Summary)**

  - `impact_summary_share_x_click`: user shared their solar footprint on X/Twitter
    - props: `source`, `wallet_address`, `total_watts`
  - `impact_summary_share_native_click`: user shared via native mobile share API
    - props: `source`, `wallet_address`, `total_watts`
  - `impact_summary_recent_farm_click`: clicked on the latest verified farm addition
    - props: `source`, `wallet_address`, `chain_id`, `farm_id`
  - `solar_collector_learn_more_open`: opened "How Solar Footprint Works" dialog
    - props: `source`, `wallet_address`
    - emitted by: `app/test/widgets/solar-collector.tsx`

- **Education**

  - `dashboard_education_click`: clicked educational outbound link
    - props: `source`, `wallet_connected`, `wallet_address`, `topic` (`mining|delegation|gctl`), `url`
    - emitted by: `app/test/widgets/solar-farm-widget.tsx`, `app/test/widgets/gctl-heatmap-widget.tsx`

- **Quick actions**

  - `dashboard_launchpad_open_click`: clicked launchpad tile
    - props: `source`, `wallet_connected`, `wallet_address`, `launchpad_mode` (`delegations|miners`)
  - `dashboard_add_liquidity_open_click`: clicked add liquidity tile
    - props: `source`, `wallet_connected`, `wallet_address`, `pair` (`glw_usdg`)
    - emitted by: `app/test/widgets/quick-actions-widget.tsx`

- **Liquidity (GLW/USDG)**
  - `dashboard_add_liquidity_review_click`
  - `dashboard_add_liquidity_update_ratio_click`
  - `dashboard_add_liquidity_go_to_swap_click`
  - `dashboard_remove_liquidity_open_click`
    - emitted by: `app/test/widgets/add-liquidity-quick-dialog.tsx`

#### Referral System

Events for the referral program, tracking user acquisition and engagement.

- **Referral Landing Page (`app/r/[code]/page.tsx`)**

  - `referral_landing_view`: page loaded with valid referral code
    - props: `code`, `referrer_wallet`, `referrer_ens`
  - `referral_landing_invalid_code`: page loaded with invalid code
    - props: `code`
  - `referral_link_click`: user clicked to link referrer
    - props: `code`, `wallet`
  - `referral_link_success`: referral link completed successfully
    - props: `code`, `wallet`
  - `referral_change_click`: user clicked to change referrer
    - props: `code`, `wallet`
  - `referral_change_success`: referrer change completed successfully
    - props: `code`, `wallet`

- **Referral Network Dialog (`components/dialogs/referral-network-dialog.tsx`)**

  - `referral_network_dialog_open`: dialog opened
    - props: `wallet_address`
  - `referral_copy_link_click`: user copied referral link
    - props: `wallet_address`
  - `referral_qr_code_open`: user opened QR code dialog
    - props: `wallet_address`
  - `referral_faq_expand`: user expanded FAQ item
    - props: `faq_id`, `wallet_address`

- **Feature Launch Modal (`components/referral/feature-launch-modal.tsx`)**

  - `referral_feature_launch_modal_view`: modal displayed to user
  - `referral_feature_launch_modal_close`: user closed modal
  - `referral_feature_launch_modal_skip`: user skipped without entering code
  - `referral_feature_launch_claim_submit`: user submitted referral code
    - props: `code`
  - `referral_feature_launch_claim_success`: code claimed successfully
    - props: `code`, `referrer_wallet`, `referrer_ens`
  - `referral_feature_launch_success_done`: user clicked done after success

- **Activation Celebration Modal (`components/referral/activation-celebration-modal.tsx`)**

  - `referral_activation_celebration_view`: celebration modal displayed
    - props: `wallet_address`

- **Change Referrer Dialog (`components/referral/change-referrer-dialog.tsx`)**

  - `referral_change_submit`: user submitted new referral code
    - props: `newCode`
  - `referral_change_success`: referrer changed successfully
    - props: `newCode`

#### Landing site (glow.org)

The marketing site (`glow.org/`) is a separate repo and still uses `@vercel/analytics/next`. It has its own Umami migration pending. Until then, marketing-site events (`newsletter_subscribe_*`) continue to flow to Vercel only.

### How to add a new event

1. Pick an existing prefix (e.g. `wallet_`, `buy_`, `marketplace_`, `api_`) and create a **snake_case** name.
2. Add the call at the **user-action boundary** (click/submit) or **outcome boundary** (success/error), not in render loops.
3. Keep payload **flat** and **non-PII**; include a stable `stage` string for failures.
4. Use wrappers:
   - Client: `import { trackEvent } from "@/lib/telemetry";`
   - Server: `import { trackServerEvent } from "@/lib/telemetry-server";`

### Viewing events in Umami

Dashboard: [`umami-production-c5d3.up.railway.app/websites/80e6d736-7ef9-4ae8-9db0-b47cf730702d`](https://umami-production-c5d3.up.railway.app/websites/80e6d736-7ef9-4ae8-9db0-b47cf730702d)

- **Events view** — filter by event name, property values (including `geo_country` / `geo_region`)
- **Reports** — pre-built funnels, retention, goals, journey, UTM
- **Sessions** — per-visitor breakdown (identified by wallet address when connected, anonymous otherwise)

### How wallets get tied to sessions

`identifyWallet(address, { chain_id })` is called from `lib/wallet-session-logger.ts` on every `connect` / `address_change`. Umami stores the wallet address as the session's `sessionId`, so:

- Every subsequent event from that session shows up under the wallet address in the Sessions view.
- The backend can join `wallet_session_events` (custom telemetry we write to gca-crm-backend) with Umami session IDs for cross-system attribution.
- Switching wallets mid-session updates the identify, so events land under the new wallet from that point on.

### Not sent to Umami

- **Pageviews in dev / preview**: the tracker script is gated on `NODE_ENV === "production"` in `app/layout.tsx`.
- **Anything on Sepolia**: `trackEvent` and `trackServerEvent` early-return when `NEXT_PUBLIC_CHAIN_ID === "11155111"`.
- **Marketing-site events**: still on Vercel until `glow.org/` migrates.
