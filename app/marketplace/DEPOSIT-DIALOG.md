# Deposit Dialog (Product Documentation)

This document describes the user-visible behavior of the **Deposit Dialog** implemented in `app/marketplace/deposit-dialog.tsx`. It covers the UI phases, supported payment paths, and end-to-end flow for **miners purchases** and **GLW delegation**.

## Overview

The Deposit Dialog is the final "review -> confirm -> processing -> success/error" modal used to complete marketplace actions for a selected listing:

- **Buy miners** (Mining Center listings): buy a quantity of "steps" priced in **USDC**.
- **Delegate GLW** (Launchpad listings): buy a quantity of "steps" priced in **GLW**.

Both actions call `fractions.buyFractions(...)`, but the payment asset and UX differ.

## Entry points (where users open it)

The dialog is typically opened from:

- `app/test/bento.tsx` (LaunchpadStatusWidget CTA in the dashboard).
- `app/launchpad/page.tsx` (launchpad page).
- `app/marketplace/mining-center-view.tsx` (miners listings view).
- `app/marketplace/launchpad-view.tsx` (hero/asset cards).
- `components/dialogs/launchpad-dialog.tsx` (legacy dialog wrapper).

## Supported payment options & chains

### Miners purchases (`selectedCurrency="USDC"`)

- **Pay with USDC** (default).
- **Pay with ETH**:
  - Only available on **Ethereum mainnet (chainId 1)** and **Sepolia (chainId 11155111)**.
  - Executes an onchain swap **ETH -> USDC** before buying miners with USDC.
  - Mainnet uses **Uniswap V2**; Sepolia uses **Uniswap V3** (SwapRouter02).

### Delegation (`selectedCurrency="GLW"`)

- **Pay with GLW**: Requires sufficient GLW balance. Default if balance is sufficient.
- **Pay with USDC**:
  - Executes an inline **multi-step swap flow** within the same dialog:
    1. USDC -> USDG (1:1 swap via USDG contract)
    2. USDG -> GLW (Uniswap)
    3. GLW delegation via `buyFractions`
- **Pay with ETH**:
  - Similar to USDC flow, but starts with:
    1. ETH -> USDC (Uniswap; mainnet V2 / sepolia V3)
    2. USDC -> USDG
    3. USDG -> GLW
    4. GLW delegation

## UI Design & Interaction

- **Quantity Selection**: +/- stepper with max availability.
- **Animated Rewards**: "Est. Weekly Rewards" animates on quantity change.
- **Smart Payment Selection**:
  - For delegation: prefers GLW if balance >= cost, otherwise USDC if available, otherwise GLW fallback.
  - For miners: defaults to USDC.
- **Payment Method List**:
  - Label changes based on context: "Delegation Source" vs "Select Currency".
  - Shows balances + estimated cost per currency.
- **Sticky Footer**: Total + primary CTA.

## UI phases (what the user sees)

### Phase A -- Review

Shown on open and before any transaction submission.

- Select quantity (clamped to remaining availability).
- Choose payment method (GLW/USDC/ETH).
- Review costs + estimated rewards.

### Phase B -- Processing (TransactionStepper)

Shown after confirmation. Displays a vertical stepper with per-step states:

- `idle` -> `waiting_signature` -> `confirming` -> `completed` / `error`

#### Processing steps (by flow)

**Direct purchase/delegation**
- "Purchase Miners" or "Delegate GLW"
- "Confirm Transaction"

**ETH payment (miners)**
- "Swap ETH -> USDC"
- "Purchase Miners"
- "Confirm Transaction"

**Swap & delegate (USDC -> GLW)**
- "Swap USDC -> USDG"
- "Swap USDG -> GLW"
- "Delegate GLW"
- "Confirm Transaction"

**Swap & delegate (ETH -> GLW)**
- "Swap ETH -> USDC"
- "Swap USDC -> USDG"
- "Swap USDG -> GLW"
- "Delegate GLW"
- "Confirm Transaction"

### Phase C -- Success

- Title + contextual description.
- Circular progress visualization of filled vs contributed steps.
- Transaction details (quantity + total).
- **Share CTA**:
  - Mobile: native share sheet (attaches a farm image when available).
  - Desktop: opens an X/Twitter share intent with a prefilled message.
- Close button returns to marketplace.

### Phase D -- Error

- "Transaction Failed" header with stepper showing failed step.
- Error details inline.
- Actions: **Close** or **Try Again** (resets to review).

### Phase E -- Smart-account blocked

Before execution, a **smart account / delegated account** check runs. If detected, the flow is blocked and a warning dialog is shown.

## Error handling

### RPC error retry mechanism

The `buyFractions` call is wrapped with automatic retry logic for transient RPC/provider errors. This handles cases where the RPC returns an internal error (code -32603) even though simulation succeeded.

**Behavior:**
- On internal RPC error, waits 1.5s then retries once
- If retry succeeds, user never sees the error
- If retry fails, shows user-friendly message: "RPC/provider error. Please retry or switch RPC."
- Non-RPC errors (contract errors, user rejection) are not retried

**Detection heuristics:**
- Error code `-32603` (JSON-RPC internal error)
- Message contains "internal error", "internalrpcerror", "could not coalesce", or "missing or invalid parameters"

### Sentry context

On error (non-user-rejection), the dialog reports to Sentry with enriched context:
- `errorCode`: JSON-RPC error code if available
- `isInternalRpcError`: boolean flag for RPC-level failures
- `connectorName`: wallet connector (e.g., "MetaMask", "WalletConnect")
- `walletClientChainId`: chain ID from wallet client
- `walletClientAccount`: account address from wallet client

## Telemetry (events)

Deposit Dialog fires telemetry events to track conversion and failures:

- `marketplace_deposit_success`
- `marketplace_deposit_error`
- `marketplace_deposit_share_x_click`
- `marketplace_deposit_share_native_click`
- `rpc_internal_error_retry` - fired when an RPC error triggers a retry attempt

## Notes / constraints

- **ETH pay is only supported on mainnet or sepolia**.
- **Estimates are approximate** (ETH quotes use buffers; weekly rewards are projections).
- **Multi-transaction flows**: Swap + delegate can require 2-4 signatures.
- **Backend processing delay**: splits polling may take up to ~60 seconds before success renders.
- **Share behavior**: native share on mobile; X/Twitter intent on desktop.

## Testing

Unit tests are in `app/marketplace/__tests__/`. Pure utility functions are extracted to `deposit-dialog-utils.ts` for testability.

### Test files

| File | Coverage |
|------|----------|
| `rpc-retry.test.ts` | RPC retry logic, error detection |
| `error-handling.test.ts` | Contract error mapping, `findErrorInMessage` |
| `cost-calculations.test.ts` | GLW/USDC/ETH cost calculations |
| `affordability.test.ts` | Balance sufficiency, buffer calculations |
| `transaction-steps.test.ts` | Step initialization for all payment flows |
| `rewards-calculations.test.ts` | Estimated rewards, impact points |
| `share-url.test.ts` | Share URL generation, quantity helpers |

### Run tests

```bash
pnpm test                                    # Run all tests
pnpm test:watch                              # Watch mode
pnpm vitest run app/marketplace/__tests__/   # Run all deposit-dialog tests
pnpm vitest run app/marketplace/__tests__/cost-calculations.test.ts  # Run specific file
```

### Test coverage (230 tests)

- **Error handling**: Error message extraction, error code extraction, RPC error detection, contract error mapping
- **Cost calculations**: GLW/USDC/ETH cost math, precision handling, edge cases
- **Affordability**: Balance checks, 2% USDC buffer, 3% ETH buffer, payment method switching
- **Transaction steps**: Step initialization for all 5 payment flows, step ordering
- **Rewards**: Launchpad vs mining rewards, impact points (emission + vault bonus)
- **Share URLs**: Twitter intent generation, URL encoding, pluralization
