# Deposit Dialog (Product Documentation)

This document describes the user-visible behavior of the **Deposit Dialog** implemented in `app/marketplace/deposit-dialog.tsx`. It covers the different UI phases, supported payment paths, and the end-to-end flow for both **miners purchases** and **GLW delegation**.

## Overview

The Deposit Dialog is the final "review → confirm → processing → success/error" modal used to complete marketplace actions for a selected listing:

- **Buy miners** (Mining Center listings): buy a quantity of "steps" priced in **USDC**.
- **Delegate GLW** (Launchpad listings): buy a quantity of "steps" priced in **GLW** (delegation).

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

- **Pay with GLW**: Requires sufficient GLW balance. Default if balance is sufficient.
- **Pay with USDC**:
  - Executes an inline **multi-step swap flow** within the same dialog:
    1. USDC → USDG (1:1 swap via USDG contract)
    2. USDG → GLW (Uniswap V2)
    3. GLW delegation via `buyFractions`
- **Pay with ETH**:
  - Similar to USDC flow, but starts with:
    1. ETH → USDC (Uniswap V2)
    2. USDC → USDG
    3. USDG → GLW
    4. GLW delegation

## UI Design & Interaction

The dialog features a modern, theme-aware UI with full light/dark mode support:

- **Quantity Selection**: Simple +/- stepper with max availability indicator.
- **Animated Rewards**: "Est. Weekly Rewards" displayed with animated value updates when quantity changes.
- **Smart Payment Selection**:
  - Automatically selects the best payment method based on wallet balance.
  - For delegation: Defaults to GLW if balance >= cost, otherwise suggests USDC/ETH.
  - For miners: Defaults to USDC.
- **Payment Method List**:
  - Label changes based on context:
    - "Delegation Source" for GLW delegation
    - "Select Currency" for miner purchases
  - Displays user's current balance for each token.
  - Shows estimated cost in that specific currency (fetching real-time ETH price for conversion).
  - Subtle selection state (5% foreground opacity, no strong colors).
- **Sticky Footer**: Contains the total cost summary and the primary action button.

## UI phases (what the user sees)

### Phase A — Review

Shown when the dialog opens and no transaction is currently submitting/processing.

What the user can do:

- **Select quantity ("steps")**
  - +/- buttons
  - Quantity is clamped to the listing's remaining availability.
- **Choose Payment Method**
  - GLW (Delegation only)
  - USDC
  - ETH
- **Review Costs & Rewards**
  - See total cost in selected currency.
  - See estimated weekly rewards in GLW and USD value.

### Phase B — Processing (TransactionStepper)

Shown after the user confirms and the dialog is submitting/processing. Features a polished, Uniswap-quality vertical timeline stepper that guides users through multi-transaction flows.

#### Visual Components

- **Header**: Animated `GlowSymbolAnimated` logo with smooth entrance animation
- **Title/Description**: "Processing Transaction" with contextual subtitle
- **TransactionStepper**: Premium vertical timeline component (`components/transaction-stepper.tsx`)

#### TransactionStepper Features

**Progress Header**:

- Segmented progress dots showing all steps (filled/active/pending colors)
- "Step X of Y" counter with current step title
- Colors: Green for completed, Primary for active, Muted for pending

**Vertical Timeline**:

- Connecting line that animates/fills as steps complete
- Step nodes with state-based styling and animations

**Step States** (5 distinct states with unique visuals):
| State | Node Visual | Description |
|-------|-------------|-------------|
| `idle` | Muted border, small dot center | Not yet started |
| `waiting_signature` | Pulsing glow ring + Wallet icon | Wallet popup open, awaiting signature |
| `confirming` | Spinning Loader2 icon | Transaction submitted, confirming on-chain |
| `completed` | Green fill + animated checkmark (path draw) | Step finished successfully |
| `error` | Red fill + X icon | Step failed with error |

**Step Cards**:

- **Token pair icons**: Shows `tokenFrom → tokenTo` (e.g., ETH → USDC icon pair)
- **Title**: Step name (e.g., "Swap ETH → USDC")
- **Status text**: Contextual (e.g., "Waiting for signature...", "Confirming on-chain...")
- **Elapsed timer**: Shows seconds elapsed for active steps (Clock icon + Xs)
- **Etherscan link**: Appears for completed steps with `txHash` (External link icon)
- **Error details**: Red box with error message for failed steps

**Animations**:

- Step entry: Staggered slide-in (0.08s delay per step)
- Pulse effect: Continuous glow ring for `waiting_signature` state
- Checkmark draw: SVG path animation on completion
- Timeline fill: ScaleY animation from top as steps complete
- Status text: Fade + slide transitions between states

#### Processing Steps (by flow)

**Direct Purchase/Delegation**:

- "Purchase Miners" or "Delegate GLW"
- "Confirm Transaction"

**ETH Payment (Miners)**:

- "Swap ETH → USDC" (tokenFrom: ETH, tokenTo: USDC)
- "Purchase Miners"
- "Confirm Transaction"

**Swap & Delegate (USDC → GLW)**:

- "Swap USDC → USDG"
- "Swap USDG → GLW"
- "Delegate GLW"
- "Confirm Transaction"

**Swap & Delegate (ETH → GLW)**:

- "Swap ETH → USDC"
- "Swap USDC → USDG"
- "Swap USDG → GLW"
- "Delegate GLW"
- "Confirm Transaction"

### Phase C — Success

Shows a beautiful success state with:

- **Title**: "Purchase Complete!" or "Delegation Complete!"
- **Description**: Contextual message about solar deployment or rewards activation
- **Circular Progress Visualization**: Animated segmented circle showing:
  - Purple/dimmed segment: Already filled portions
  - Green/yellow segment: User's contribution
  - Center label: "X/Y" (filled/total) with "Z left"
- **Transaction Details**: Quantity and total amount delegated/spent
- **Share Button**:
  - For GLW delegation: "Share on X" (white button) with customized tweet text mentioning the farm name
  - For Miner purchases: "Share on Twitter" (Twitter blue) with miner purchase message
- **Close Button**: Returns to marketplace

### Phase D — Error

Shown when a transaction step fails. The error is displayed inline within the TransactionStepper:

- **Header**: Red X icon with animated entrance, "Transaction Failed" title
- **TransactionStepper**: Shows all steps with the failed step marked in red
  - Failed step: Red node with X icon, red title text
  - Error details: Red box below the step with the error message (line-clamp-2)
- **Action Buttons**:
  - "Close": Dismisses dialog
  - "Try Again": Resets to review phase, clears all step state

### Phase E — Smart-account blocked (warning modal)

Before executing the action, the dialog performs a **smart account / delegated account** check. If a smart account is detected, the action is blocked and a separate warning dialog is shown.

## Core flows (end-to-end)

### Flow 1 — Buy miners with USDC

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User selects **USDC** payment method.
4. User clicks **Confirm Purchase**.
5. System:
   - Checks balance.
   - Calls `fractions.buyFractions(...)`.
   - Polls splits to confirm completion.
   - Shows success state with circular progress.
6. On success: User can share on Twitter and close.

### Flow 2 — Buy miners with ETH (ETH → USDC → buy)

1. User opens Deposit Dialog for a miners listing (`selectedCurrency="USDC"`).
2. User sets **Quantity**.
3. User selects **ETH** payment method.
4. User clicks **Confirm Purchase**.
5. System enters processing phase with steps:
   - **Step 1**: "Swapping ETH to USDC" - User signs ETH swap, timer starts
   - **Step 2**: "Purchasing Miners" - User signs purchase
   - **Step 3**: "Confirming Transaction" - Polls backend
6. Success state shows with circular progress and Twitter share.

### Flow 3 — Delegate GLW (direct)

1. User opens Deposit Dialog for a launchpad listing (`selectedCurrency="GLW"`).
2. User sets **Quantity**.
3. User selects **GLW** payment method (if balance sufficient).
4. User clicks **Confirm Delegation**.
5. System:
   - Calls `fractions.buyFractions(...)` paying in GLW.
   - Polls splits to confirm completion.
6. On success: Circular progress visualization with "Share on X" featuring farm name.

### Flow 4 — Delegate GLW (via Swap) - INLINE FLOW

**Important**: This flow now happens **entirely within the deposit dialog** (no longer opens BuyGlowDialog).

If the user selects USDC or ETH for a delegation (GLW) listing:

1. Button text changes to **"Swap & Delegate"**.
2. User clicks button.
3. Dialog enters processing phase with **multi-step progress**:
   - If paying with ETH:
     - **Step 1**: "Swapping ETH to USDC" - User signs, timer starts
     - **Step 2**: "Swapping USDC to USDG" - User signs
     - **Step 3**: "Swapping USDG to GLW" - User signs
     - **Step 4**: "Delegating GLW" - User signs final delegation
     - **Step 5**: "Confirming Transaction" - Polls backend
   - If paying with USDC:
     - **Step 1**: "Swapping USDC to USDG" - User signs, timer starts
     - **Step 2**: "Swapping USDG to GLW" - User signs
     - **Step 3**: "Delegating GLW" - User signs delegation
     - **Step 4**: "Confirming Transaction" - Polls backend
4. Success state shows with circular progress and customized Twitter share.

## Telemetry (events)

Deposit Dialog fires telemetry events to track conversion and failures:

- `marketplace_deposit_confirm_click`
- `marketplace_deposit_blocked_smart_account`
- `marketplace_deposit_eth_swap_submit`
- `marketplace_deposit_eth_swap_confirmed`
- `marketplace_deposit_tx_submitted`
- `marketplace_deposit_confirmed`
- `marketplace_deposit_share_x_click`
- `marketplace_deposit_error`

## Visual Design Updates

### Theme Support

- Full light/dark mode support using semantic Tailwind classes
- `bg-background`, `text-foreground`, `border-border` replace hardcoded hex values
- Payment selection uses subtle `bg-foreground/5` instead of strong accent colors

### Processing UI (TransactionStepper)

The processing phase now uses a dedicated `TransactionStepper` component for a polished, Uniswap-quality experience:

- **GlowSymbolAnimated**: Animated Glow logo in header during processing
- **Vertical Timeline**: Premium stepper with connecting line that fills on progress
- **Rich Step States**: 5 distinct states with unique visuals and animations
  - `idle`: Muted, not started
  - `waiting_signature`: Pulsing glow ring + Wallet icon (awaiting user signature)
  - `confirming`: Spinning loader (on-chain confirmation)
  - `completed`: Green fill + animated checkmark path draw
  - `error`: Red fill + X icon with error details
- **Token Icons**: Each swap step shows `tokenFrom → tokenTo` icon pair
- **Elapsed Timer**: Active steps show real-time elapsed seconds
- **Etherscan Links**: Completed steps with txHash show "View on Etherscan" link
- **Staggered Animations**: Steps slide in with 80ms stagger delay
- **Error Inline**: Failed steps show error message in red box below the step

### Success UI

- **Circular Progress**: `SegmentedCircleProgress` component shows contribution visually
  - Delegation: Purple (already filled) + Green (user contribution)
  - Miners: Dimmed white (already filled) + Miner yellow (user contribution)
- **Twitter Share**: Context-aware button
  - GLW delegation: White button with farm-specific tweet
  - Miners: Twitter blue button with generic message

## Known limitations / gotchas

- **ETH pay only on mainnet or sepolia** (by design).
- **Estimates are approximate**:
  - ETH needed is computed from a quote and padded with buffers (2% on ETH amount, 5% refinement iterations).
  - Weekly rewards are estimates based on current epoch data.
- **Multi-transaction UX**:
  - Delegation via swap requires 2-4 transactions depending on payment method.
  - Each transaction requires a separate wallet signature.
  - Timer only starts after first signature to avoid confusing countdown during wallet review.
- **Backend processing delay**:
  - Even after onchain confirmation, the splits polling may take up to 60 seconds.
  - The success state won't show until backend confirms the purchase.
- **Sepolia Testing**:
  - Swap steps (ETH→USDC, USDC→USDG, USDG→GLW) are mocked on non-mainnet chains.
  - Final delegation/purchase transaction is always real on the connected chain.
  - This allows UI flow testing without mainnet contract dependencies.

## Technical Notes

- Uses `useOffchainFractions` with dynamic `chainId` parameter for multi-chain support
- ETH price fallback: tries Uniswap quote first, falls back to Coingecko API
- Progress estimation: ~15-20s per swap step, ~10s for confirmation
- Circle progress uses Framer Motion for smooth animations
- All swap calls wrapped in `if (chainId === 1)` checks for testnet mocking

### TransactionStepper Component

The `components/transaction-stepper.tsx` component is a reusable, self-contained stepper for multi-transaction flows:

**Types**:

```typescript
type StepStatus =
  | "idle"
  | "waiting_signature"
  | "confirming"
  | "completed"
  | "error";

interface TransactionStep {
  id: string;
  title: string;
  description?: string;
  tokenFrom?: "ETH" | "USDC" | "USDG" | "GLW";
  tokenTo?: "ETH" | "USDC" | "USDG" | "GLW";
  status: StepStatus;
  txHash?: string;
  startedAt?: number;
  errorMessage?: string;
}
```

**Props**:

- `steps: TransactionStep[]` - Array of step definitions with status
- `chainId?: number` - For Etherscan link generation (defaults to 1)
- `className?: string` - Additional styling

**Animation Variants** (in `animations/variants.ts`):

- `stepEntryVariants`: Staggered slide-in for step cards
- `pulseGlowVariants`: Pulsing ring for waiting_signature state
- `checkmarkDrawVariants`: SVG path animation for checkmark
- `timelineFillVariants`: ScaleY animation for timeline fill
- `stepContentSlideVariants`: Content fade + slide transitions
- `statusBadgeVariants`: Status text transitions
