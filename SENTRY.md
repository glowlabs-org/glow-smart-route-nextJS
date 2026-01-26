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

## Gaps - Missing Error Tracking

### Referral System (HIGH PRIORITY)

The referral feature has no Sentry error tracking. Add tracking for:

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `hooks/use-referral.ts` | `linkReferrer` fails | `referralStage: "link"` |
| `hooks/use-referral.ts` | `changeReferrer` fails | `referralStage: "change"` |
| `hooks/use-referral.ts` | `validateCode` fails | `referralStage: "validate"` |
| `app/r/[code]/page.tsx` | Link/change throws | `referralStage: "landing_link"` |
| `components/referral/feature-launch-modal.tsx` | Claim with code fails | `referralStage: "feature_launch_claim"` |
| `components/referral/change-referrer-dialog.tsx` | Change referrer fails | `referralStage: "change_dialog"` |
| `components/referral/activation-celebration-modal.tsx` | Mark seen fails | `referralStage: "activation_seen"` |
| `components/dialogs/referral-network-dialog.tsx` | Network data fetch fails | `referralStage: "network_fetch"` |

### Marketplace / Launchpad

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `app/marketplace/deposit-dialog.tsx` | Deposit transaction fails | `marketplaceStage: "deposit"` |
| `app/marketplace/launchpad-view.tsx` | Data fetch fails | `marketplaceStage: "fetch"` |

### Wallet Operations

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `app/wallet/claims-panel.tsx` | Claim transaction fails | `walletStage: "claim"` |
| `components/wallet-widget.tsx` | Balance fetch fails | `walletStage: "balance_fetch"` |

### GCTL Minting

| File | Error Case | Suggested Tags |
|------|------------|----------------|
| `components/dialogs/mint-and-stake-gctl-dialog.tsx` | Mint fails | `gctlStage: "mint"` |
| `components/dialogs/mint-and-stake-gctl-dialog.tsx` | Stake fails | `gctlStage: "stake"` |

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
