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

## Supported payment options & chains

### Miners purchases (`selectedCurrency="USDC"`)

- **Pay with USDC** (default).
- **Pay with ETH** (optional):
  - Only available on **Ethereum mainnet (chainId 1)** and **Sepolia (chainId 11155111)**.
  - Executes an onchain swap **ETH → USDC** (Uniswap V2 router) before buying miners with USDC.

### Delegation (`selectedCurrency="GLW"`)

- Requires **GLW** in the wallet.
- If the user is short on GLW, the dialog provides a **Buy GLW** path via `BuyGlowDialog`, which supports paying with **ETH / USDC / USDG**.

## UI phases (what the user sees)

The dialog is rendered via `components/dialogs/transaction-dialog.tsx`, with custom content from `deposit-dialog.tsx`.

### Phase A — Review

Shown when the dialog opens and no transaction is currently submitting/processing.

What the user can do:

- **Select quantity (“steps”)**
  - +/- buttons
  - manual numeric input
  - Min/Max quick actions
  - Quantity is clamped to the listing’s remaining availability.
- **(Miners only) Choose “You pay”**
  - USDC (default)
  - ETH (only on mainnet or sepolia)
- Review balance + warnings
  - Shows token balances and “Top up” warnings if needed.

### Phase B — Processing

Shown after the user confirms and the dialog is submitting/processing.

Key behaviors:

- The dialog prevents dismissing by clicking outside.
- Copy changes based on the current processing step:
  - “Swapping ETH → USDC” (miners ETH only)
  - “Processing Miners Purchase” / “Processing Delegation”
  - “Confirming Purchase/Delegation” (while waiting for splits confirmation)

### Phase C — Success

Shown when the dialog confirms the action completed.

User-visible notes:

- The dialog explicitly tells users it may take **up to ~1 minute** for the result to show on the power wallet page due to backend processing.
- For delegation (GLW), the success footer includes a link to `/wallet`.

### Phase D — Error

Shown when something fails (swap, buy tx, confirmation timeout, etc.).

Key UX:

- Error message is surfaced via toast + dialog content.
- If a tx hash exists and is embedded in the error message, the dialog shows a “Transaction ID” block with copy-to-clipboard and support CTA.

### Phase E — Smart-account blocked (warning modal)

Before executing the action, the dialog performs a **smart account / delegated account** check. If a smart account is detected, the action is blocked and a warning dialog is shown.

## Core flows (end-to-end)

### Flow 1 — Buy miners with USDC

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User leaves “You pay” as **USDC**.
4. Confirm button is enabled when the user has enough USDC and quantity is valid.
5. On confirm:
   - Calls `fractions.buyFractions(...)` paying in USDC.
   - Then polls “splits” until it sees the purchase reflected (see “Confirming via splits”).
6. On success:
   - Shows success UI and the backend-processing note.

### Flow 2 — Buy miners with ETH (ETH → USDC → buy)

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User sets “You pay” to **ETH** (only available on mainnet/sepolia).
4. Dialog estimates:
   - ETH balance
   - approximate ETH needed to swap to cover the missing USDC
   - approximate USDC output
5. On confirm:
   - If the wallet already has sufficient USDC, the flow proceeds without swapping.
   - Otherwise:
     - Swaps **ETH → USDC** on Uniswap V2 (`useSwapETHToUSDC`).
     - Re-checks USDC balance.
   - Calls `fractions.buyFractions(...)` paying in USDC.
   - Polls splits to confirm completion.

Important notes:

- The ETH amount is estimated with buffers; exact required ETH can drift with price movement and gas.
- The swap and the miners purchase are separate onchain transactions (multi-tx flow).

### Flow 3 — Delegate GLW (direct)

1. User opens Deposit Dialog for a launchpad listing (`selectedCurrency="GLW"`).
2. User sets **Quantity**.
3. Confirm button is enabled when:
   - wallet is connected,
   - quantity is valid,
   - GLW balance is sufficient.
4. On confirm:
   - Calls `fractions.buyFractions(...)` paying in GLW.
   - Polls splits to confirm completion.
5. On success:
   - Shows success UI + link to `/wallet`.

### Flow 4 — Delegate GLW (with top-up via Buy GLW)

If the user is short on GLW:

1. The dialog shows a **“Top up GLW to continue”** panel.
2. User clicks **Buy GLW**.
3. `BuyGlowDialog` opens and the user can fund the purchase with **ETH / USDC / USDG**.
4. On success, the dialog refetches balances.
5. User returns to Deposit Dialog and confirms delegation once GLW is sufficient.

## Confirm / disable rules (high-level)

The confirm button is disabled when any of the following is true:

- Wallet is not connected.
- Quantity is invalid (0, or above remaining availability).
- A tx is already submitting/processing.
- Insufficient funds for the selected pay path:
  - Miners + USDC pay: insufficient USDC.
  - Miners + ETH pay: insufficient ETH (based on estimate + buffer), or quote/balance is not yet known.
  - Delegation: insufficient GLW.

## Confirmation via “splits” (post-transaction validation)

After submitting the purchase/delegation transaction, the dialog verifies completion by polling the user’s “splits” summary:

- Poll interval: **5 seconds**
- Max wait: **60 seconds**
- Success condition: `totalStepsPurchased` increases vs the initial value.

If the confirmation times out, the dialog shows an error indicating the transaction may still be processing and the user should check their wallet.

## Telemetry (events)

Deposit Dialog fires telemetry events to track conversion and failures:

- `marketplace_deposit_confirm_click`
  - When the user clicks confirm.
  - Includes `currency`, and for miners includes `pay_token` (USDC or ETH).
- `marketplace_deposit_blocked_smart_account`
  - When the dialog blocks execution due to smart account detection.
- `marketplace_deposit_eth_swap_submit`
  - When beginning the ETH → USDC swap (miners ETH only).
- `marketplace_deposit_eth_swap_confirmed`
  - After the ETH → USDC swap confirms.
- `marketplace_deposit_tx_submitted`
  - When the core `buyFractions` tx is submitted.
- `marketplace_deposit_confirmed`
  - When the purchase/delegation is confirmed via splits.
- `marketplace_deposit_buy_glw_click`
  - When the user clicks Buy GLW in the GLW shortfall UI.
- `marketplace_deposit_buy_glw_dialog_open`
  - When `BuyGlowDialog` opens.
- `marketplace_deposit_error`
  - Generic error reporting with a `stage` string and contextual metadata.

## Known limitations / gotchas

- **ETH pay only on mainnet or sepolia** (by design).
- **Estimates are approximate**:
  - ETH needed is computed from a quote and padded with buffers.
  - Gas fee estimate may fall back to a conservative buffer.
- **Multi-transaction UX**:
  - Miners ETH pay requires at least one swap tx, then the miners purchase tx.
- **Backend processing delay**:
  - Even after onchain confirmation, the power wallet page may take up to ~1 minute to reflect changes.
