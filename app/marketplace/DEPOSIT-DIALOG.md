# Deposit Dialog (Product Documentation)

This document describes the user-visible behavior of the **Deposit Dialog** implemented in `app/marketplace/deposit-dialog.tsx`. It covers the different UI phases, supported payment paths, and the end-to-end flow for both **miners purchases** and **GLW delegation**.

## Overview

The Deposit Dialog is the final “review → confirm → processing → success/error” modal used to complete marketplace actions for a selected listing:

- **Buy miners** (Mining Center listings): buy a quantity of “steps” priced in **USDC**.
- **Delegate GLW** (Launchpad listings): buy a quantity of “steps” priced in **GLW** (delegation).

Both actions ultimately call `fractions.buyFractions(...)`, but the payment asset and UX differ.

## Entry points (where users open it)

The dialog is typically opened from:

- `components/dialogs/launchpad-dialog.tsx`
  - If the selected listing is `_type === "miners"` → opens with `selectedCurrency="USDC"`.
  - Otherwise → opens with `selectedCurrency="GLW"`.
- `app/marketplace/mining-center-view.tsx` (miners listings view).
- `app/marketplace/launchpad-view.tsx` (hero/asset cards).

## Supported payment options & chains

### Miners purchases (`selectedCurrency="USDC"`)

- **Pay with USDC** (default).
- **Pay with ETH**:
  - Only available on **Ethereum mainnet (chainId 1)** and **Sepolia (chainId 11155111)**.
  - Executes an onchain swap **ETH → USDC** (Uniswap V2 router) before buying miners with USDC.

### Delegation (`selectedCurrency="GLW"`)

- **Pay with GLW**: Requires sufficient GLW balance.
- **Pay with USDC or ETH**:
  - If the user selects a currency other than GLW for delegation, the dialog automatically switches to a **"Swap & Delegate"** flow.
  - This redirects to `BuyGlowDialog` to first acquire GLW, then returns the user to the delegation flow.

## UI Design & Interaction

The dialog features a modern, dark-themed UI (`bg-[#0A0A0A]`) with:

- **Quantity Selection**: Simple +/- stepper with direct numeric input and max availability indicator.
- **Animated Rewards**: "Est. Weekly Rewards" displayed with a glowing effect and `framer-motion` animations when values update.
- **Smart Payment Selection**:
  - Automatically selects the best payment method based on wallet balance.
  - For delegation: Defaults to GLW if balance >= cost, otherwise suggests USDC/ETH.
  - For miners: Defaults to USDC.
- **Payment Method List**: 
  - Displays GLW, USDC, and ETH options.
  - Shows user's current balance for each token.
  - Shows estimated cost in that specific currency (fetching real-time ETH price for conversion).
- **Sticky Footer**: Contains the total cost summary and the primary action button.

## UI phases (what the user sees)

The dialog manages its own internal state rather than relying on an external `transaction-dialog` wrapper.

### Phase A — Review

Shown when the dialog opens and no transaction is currently submitting/processing.

What the user can do:

- **Select quantity (“steps”)**
  - +/- buttons
  - Quantity is clamped to the listing’s remaining availability.
- **Choose Payment Method**
  - GLW (Delegation only)
  - USDC
  - ETH
- **Review Costs & Rewards**
  - See total cost in selected currency.
  - See estimated weekly rewards in GLW and USD value.

### Phase B — Processing

Shown after the user confirms and the dialog is submitting/processing. The primary button shows a loading spinner.

Key behaviors:

- Copy/State changes based on the current processing step:
  - “Swapping ETH → USDC” (miners ETH only)
  - “Purchasing miners...” / “Delegating GLW...”
  - “Confirming transaction...” (while waiting for splits confirmation)

### Phase C — Success

Shown via a toast notification upon successful completion. The dialog closes automatically on success.

### Phase D — Error

Shown via toast notifications if something fails (swap, buy tx, confirmation timeout, etc.).

### Phase E — Smart-account blocked (warning modal)

Before executing the action, the dialog performs a **smart account / delegated account** check. If a smart account is detected, the action is blocked and a separate warning dialog is shown.

## Core flows (end-to-end)

### Flow 1 — Buy miners with USDC

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User selects **USDC** payment method.
4. User clicks **Confirm Payment**.
5. System:
   - Checks balance.
   - Calls `fractions.buyFractions(...)`.
   - Polls splits to confirm completion.
6. On success: Toast "Miners purchased!" and dialog closes.

### Flow 2 — Buy miners with ETH (ETH → USDC → buy)

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User selects **ETH** payment method.
4. User clicks **Confirm Payment**.
5. System:
   - Calculates missing USDC.
   - Estimates ETH needed (with buffer).
   - Swaps **ETH → USDC** on Uniswap V2 (`useSwapETHToUSDC`).
   - Refetches USDC balance to ensure swap was sufficient.
   - Calls `fractions.buyFractions(...)` paying in USDC.
   - Polls splits to confirm completion.

### Flow 3 — Delegate GLW (direct)

1. User opens Deposit Dialog for a launchpad listing (`selectedCurrency="GLW"`).
2. User sets **Quantity**.
3. User selects **GLW** payment method (if balance sufficient).
4. User clicks **Confirm Payment**.
5. System:
   - Calls `fractions.buyFractions(...)` paying in GLW.
   - Polls splits to confirm completion.
6. On success: Toast "Delegation successful!" and dialog closes.

### Flow 4 — Delegate GLW (via Swap)

If the user selects USDC or ETH for a delegation (GLW) listing:

1. Button text changes to **"Swap & Delegate"**.
2. User clicks button.
3. Dialog opens `BuyGlowDialog` pre-filled with the required GLW amount.
4. User completes purchase in `BuyGlowDialog`.
5. On success, `DepositDialog` remains open (or user re-opens) with updated GLW balance to proceed with Flow 3.

## Telemetry (events)

Deposit Dialog fires telemetry events to track conversion and failures:

- `marketplace_deposit_confirm_click`
- `marketplace_deposit_blocked_smart_account`
- `marketplace_deposit_eth_swap_submit`
- `marketplace_deposit_eth_swap_confirmed`
- `marketplace_deposit_tx_submitted`
- `marketplace_deposit_confirmed`
- `marketplace_deposit_buy_glw_click`
- `marketplace_deposit_buy_glw_dialog_open`
- `marketplace_deposit_error`

## Known limitations / gotchas

- **ETH pay only on mainnet or sepolia** (by design).
- **Estimates are approximate**:
  - ETH needed is computed from a quote and padded with buffers.
  - Gas fee estimate may fall back to a conservative buffer.
- **Multi-transaction UX**:
  - Miners ETH pay requires at least one swap tx, then the miners purchase tx.
- **Backend processing delay**:
  - Even after onchain confirmation, the power wallet page may take up to ~1 minute to reflect changes.
