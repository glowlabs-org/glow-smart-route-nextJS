# Sentry Error Tracking

This document maps all error tracking in the Glow frontend using Sentry, identifying what's covered and what gaps exist.

---

## Configuration

Sentry is initialized in:

- **Client**: `instrumentation-client.ts`
- **Server**: `sentry.server.config.ts`
- **Edge**: `sentry.edge.config.ts`

Features enabled:
- Session Replay (10% sample, 100% on error)
- Network detail capture for API calls
- Trace sampling (100%)
- Logs enabled

---

## Current Error Tracking

### Global Error Boundaries

| File | Stage | Tags | Description |
|------|-------|------|-------------|
| `app/error.tsx` | `error_boundary` | - | Catches unhandled errors in routes |
| `app/global-error.tsx` | `global_error` | - | Catches errors at root layout level |

### Terms of Service (`components/tos-dialog.tsx`)

| Stage Tag | Description |
|-----------|-------------|
| `tosStage: "status_check"` | Failed to check TOS acceptance status |
| `tosStage: "eip712_signing"` | Failed to get EIP-712 typed data signature |
| `tosStage: "signature_validation"` | Signature returned empty |
| `tosStage: "api_submission"` | Failed to submit signed TOS to API |
| `tosStage: "general_error"` | Catch-all for unexpected errors |

Additional tags and context for ToS errors:
- Tags: `connectorName`, `connectorId`, `chainId`, `walletChainId`, `expectedChainId`, `signingMethod`, `signatureType`, `tosErrorType`
- Extra fields: `errorCode`, `errorReason`, `errorShortMessage`, `errorInfo`, `errorData`, `errorCause`, `errorStack`, `rawError`, `isWrongNetwork`

### Swap Flow (`app/buy/swap-interface.tsx`, `hooks/useSwap.ts`)

| Stage Tag | Description |
|-----------|-------------|
| `swapFlow: "handleBuy"` | Buy transaction failed |
| `estimateFlow: "estimateAmount"` | Failed to estimate swap amount |
| `swapStage: "token_approval"` | Token approval transaction failed |
| `swapStage: "token_swap"` | Swap transaction failed |
| `swapStage: "glow_approval"` | GLW approval failed |
| `swapStage: "glow_swap"` | GLW swap failed |

### Rewards Claiming (`hooks/useRewardsKernelWrapper.ts`)

| Stage Tag | Description |
|-----------|-------------|
| `claimStage: "inflation"` | GLW emission rewards claim failed |

---

## Implemented Error Tracking

### Referral System

| File | Stage Tag | Description |
|------|-----------|-------------|
| `hooks/use-referral.ts` | `referralStage: "link"` | Link referrer failed |
| `hooks/use-referral.ts` | `referralStage: "change"` | Change referrer failed |
| `components/referral/feature-launch-modal.tsx` | `referralStage: "feature_launch_claim"` | Claim with code failed |
| `components/referral/activation-celebration-modal.tsx` | `referralStage: "activation_seen"` | Mark activation seen failed |

### GCTL Minting & Staking

| File | Stage Tag | Description |
|------|-----------|-------------|
| `components/dialogs/mint-and-stake-gctl-dialog.tsx` | `gctlStage: "mint_stake"` | Mint & stake GCTL failed |
| `components/dialogs/mint-and-stake-gctl-dialog.tsx` | `gctlStage: "stake_existing"` | Stake existing GCTL failed |

### Marketplace

| File | Stage Tag | Description |
|------|-----------|-------------|
| `app/marketplace/deposit-dialog.tsx` | `marketplaceStage: "deposit"` | Deposit/purchase transaction failed |

### Wallet Claims

| File | Stage Tag | Description |
|------|-----------|-------------|
| `app/wallet/claims-panel.tsx` | `walletStage: "claim_single_reward"` | Single reward claim failed |
| `app/wallet/claims-panel.tsx` | `walletStage: "claim_confirmation"` | Claim confirmation failed |

### Wallet Connection Diagnostics

| File | Event/Tags | Description |
|------|------------|-------------|
| `components/connect-button.tsx` | `walletStage: "connect"` + `walletConnectorId`, `walletConnectorName` | Captures connector errors from `useConnect` (includes `code`, `shortMessage`, `details`) |
| `components/connect-button.tsx` | `kind: "wallet_connect_pending"` + `walletConnectorId`, `walletConnectorName` | Emits warning if connection remains pending after timeout (12s) |
| `components/connect-button.tsx` | `kind: "wallet_connect_show_timeout"` + `walletConnectorId`, `walletConnectorName` | Emits warning if AppKit modal remains open with an unresolved pending connection after timeout (15s) |
| `components/connect-button.tsx` | `walletStage: "connect"` + `walletError: "walletconnect_proposal_expired"` | Captures handled WalletConnect proposal expiry rejections and suppresses duplicate unhandled-rejection noise |
| `lib/wagmi-config.ts` | `kind: "wallet_connector_debug"` + `connectorId`, `walletEvent` | Debug messages for MetaMask provider resolution fallbacks and provider-not-found conditions |

Wallet connector debug events currently emitted:
- `metamask_provider_fallback_window_ethereum`
- `metamask_provider_fallback_rejected_non_metamask`
- `metamask_provider_not_found`

Note: User signature rejections (code 4001) are excluded from Sentry reporting.

Additional client-side filtering (in `instrumentation-client.ts` `beforeSend`):
- Wallet connectivity/hardware wallet transient failures (e.g. `device disconnected during action`) are dropped to avoid noisy, non-actionable errors.

---

## Gaps - Missing Error Tracking

### Marketplace / Launchpad

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `app/marketplace/launchpad-view.tsx` | Data fetch fails | `marketplaceStage: "fetch"` |

### Wallet Operations

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `components/wallet-widget.tsx` | Balance fetch fails | `walletStage: "balance_fetch"` |

### API Routes

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `app/api/newsletter/route.ts` | Subscription fails | `apiStage: "newsletter"` |
| `app/api/ens-names/route.ts` | ENS resolution fails | `apiStage: "ens"` |

---

## Implementation Pattern

When adding Sentry error tracking, follow this pattern:

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // risky operation
} catch (error) {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));

  Sentry.captureException(normalizedError, {
    tags: {
      featureStage: "stage_name",
    },
    extra: {
      // Add relevant context (no PII)
      walletAddress: address,
      code: referralCode,
    },
  });

  // Still handle the error for UX (toast, state update, etc.)
  throw error; // or handle gracefully
}
```

---

## Tag Naming Convention

- **Format**: `{feature}Stage: "{action}"`
- **Features**: `referral`, `swap`, `tos`, `claim`, `gctl`, `marketplace`, `wallet`, `api`
- **Actions**: verb describing the operation (e.g., `link`, `validate`, `mint`, `fetch`)

Examples:
- `referralStage: "link"`
- `swapStage: "token_approval"`
- `gctlStage: "mint"`

---

## Priority Implementation Order

1. **Referral System** - New feature, needs full coverage
2. **GCTL Minting** - High-value user action
3. **Marketplace Deposits** - Financial transactions
4. **Wallet Claims** - Financial transactions
5. **API Routes** - Backend reliability

---

## Viewing Errors in Sentry

Dashboard: https://sentry.io → Projects → glow-smart-route-nextjs

Filter by tags:
- `referralStage:*` - All referral errors
- `swapStage:*` - All swap errors
- `tosStage:*` - All TOS errors
