# SGCTL Delegations Frontend Implementation Plan

## Document Intent
This plan defines the full frontend implementation for SGCTL delegations in the marketplace deposit flow.

It is designed to support incremental delivery with commit-by-commit TODO checklists so we can review progress and validate behavior after each commit.

## Date
March 5, 2026

## Inputs Reviewed
- CRM backend PR: https://github.com/glowlabs-org/gca-crm-backend-merged/pull/23
- Control/impact backend PR URL provided: https://github.com/glowlabs-org/glow-impact-backend/pull/9 (not accessible from this environment)
- Local backend references used for equivalent implementation details:
  - `/Users/julientremblay/Projects/glow/main-repos/gca-crm-backend`
  - `/Users/julientremblay/Projects/glow/main-repos/glow-control-backend`
- Frontend references:
  - `app/marketplace/deposit-dialog.tsx`
  - `app/marketplace/deposit-dialog-utils.ts`
  - `app/marketplace/DEPOSIT-DIALOG.md`
  - `components/dialogs/mint-and-stake-gctl-dialog.tsx`

## Product Requirements (Confirmed)
1. SGCTL is an offchain delegation mode and must not be modeled as an onchain purchase flow.
2. If user has enough staked GCTL in region, delegate immediately.
3. If user has liquid GCTL but not staked in region, stake then delegate.
4. If user has no/insufficient GCTL, allow mint+stake using USDC or ETH, then delegate.
5. Keep existing GLW delegation and miner purchase flows intact.

## Target UX Behavior
For launchpad rows in SGCTL phase (`activeFraction.delegationAsset === "SGCTL"`), the deposit dialog becomes a preparation + delegation flow:

1. Review quantity and required SGCTL amount.
2. Choose source path:
   - Use existing staked balance
   - Stake wallet GCTL
   - Mint+stake with USDC
   - Mint+stake with ETH
3. Execute preparation steps.
4. Sign and submit SGCTL delegation (`POST /control/delegate-sgctl`).
5. Poll splits until confirmation and show success.

For launchpad rows in GLW phase, keep current GLW/USDC/ETH swap/delegate behavior.

## Technical Decisions
1. Keep `DepositDialog` entry points stable and derive runtime mode from listing metadata.
2. Treat SGCTL amount using GCTL decimal precision (`6`) and display label as `SGCTL`.
3. Reuse mint/stake logic from `mint-and-stake-gctl-dialog.tsx` by extracting a shared orchestration layer (hook/service) to avoid code drift.
4. Keep transaction stepper as source of truth for user-facing progress.
5. Keep split polling as final confirmation gate.

## Files Expected To Change
- `hooks/hub-listings.ts`
- `app/marketplace/launchpad-view.tsx`
- `app/launchpad/page.tsx`
- `app/test/bento.tsx`
- `components/dialogs/launchpad-dialog.tsx` (only if prop typing changes)
- `app/marketplace/deposit-dialog-utils.ts`
- `app/marketplace/deposit-dialog.tsx`
- `components/dialogs/mint-and-stake-gctl-dialog.tsx` (or extracted shared logic file)
- `hooks/control-gctl.ts` (if shared helper is added)
- `app/marketplace/__tests__/transaction-steps.test.ts`
- `app/marketplace/__tests__/affordability.test.ts`
- `app/marketplace/__tests__/cost-calculations.test.ts`
- `app/marketplace/DEPOSIT-DIALOG.md`
- `TELEMETRY.md`
- `SENTRY.md`

## Commit-by-Commit Implementation Plan

### Commit 1: Listing Contract + SGCTL Visibility
Goal: Make SGCTL-phase listings visible and strongly typed.

TODOs:
- [ ] Extend `ActiveFraction` typing in `hooks/hub-listings.ts` with `delegationAsset`, `delegationPhase`, and related fields returned by backend.
- [ ] Ensure payment currency typing accommodates launchpad SGCTL phase representation (`GCTL` in API, SGCTL in UI labeling).
- [ ] Remove GLW-only hard filter in launchpad listing queries where needed (`launchpad-view`, `launchpad/page`, `bento`) so SGCTL rows are fetched.
- [ ] Keep miners filters unchanged (`USDC`).

Exit criteria:
- [ ] SGCTL-phase launchpad rows appear in UI lists.
- [ ] No TypeScript casts needed for SGCTL metadata access.

Validation:
- [ ] `pnpm lint`

---

### Commit 2: Deposit Dialog Mode Scaffolding
Goal: Add SGCTL mode without changing existing GLW/miner behavior.

TODOs:
- [ ] Add explicit runtime mode resolver in deposit dialog (miners vs GLW delegation vs SGCTL delegation).
- [ ] Extend utility types in `deposit-dialog-utils.ts` for SGCTL methods/steps/cost display.
- [ ] Add SGCTL-specific transaction steps in `initializeTransactionSteps`.
- [ ] Add SGCTL-specific affordability/cost helpers using 6 decimals and SGCTL labels.

Exit criteria:
- [ ] Dialog can render SGCTL mode state and steps (logic-only).
- [ ] Existing GLW and miner tests still pass.

Validation:
- [ ] `pnpm lint`
- [ ] `pnpm vitest run app/marketplace/__tests__/transaction-steps.test.ts`
- [ ] `pnpm vitest run app/marketplace/__tests__/cost-calculations.test.ts`

---

### Commit 3: Shared GCTL Preparation Orchestrator
Goal: Reuse mint/stake behavior from existing dialog instead of duplicating complex logic.

TODOs:
- [ ] Extract or create shared helper/hook for:
  - stake existing GCTL to region
  - mint+stake with USDC
  - mint+stake with ETH
- [ ] Keep signature/nonce handling consistent with `mint-and-stake-gctl-dialog.tsx`.
- [ ] Make helper callable from deposit dialog with required amount and region.

Exit criteria:
- [ ] One reusable interface exists for “ensure staked amount in region”.
- [ ] `mint-and-stake-gctl-dialog.tsx` behavior remains functionally unchanged.

Validation:
- [ ] `pnpm lint`

---

### Commit 4: SGCTL Execution Path in Deposit Dialog
Goal: Full end-to-end SGCTL flow in `deposit-dialog.tsx`.

TODOs:
- [ ] Add SGCTL source selection UI and auto-selection heuristics.
- [ ] Compute required SGCTL amount from fraction step * quantity.
- [ ] Branch execution:
  - direct delegate if staked amount sufficient
  - stake then delegate if wallet GCTL sufficient
  - mint+stake then delegate otherwise
- [ ] Implement signed delegation call using Control API (`fetchLastNonce`, sign typed data, `delegateSgctl`).
- [ ] Reuse split polling confirmation and success state rendering.

Exit criteria:
- [ ] SGCTL dialog path reaches success with split confirmation.
- [ ] GLW/miner paths remain unchanged.

Validation:
- [ ] `pnpm lint`

---

### Commit 5: UX Copy + Error Mapping + Telemetry
Goal: Make SGCTL path user-complete and observable.

TODOs:
- [ ] Update SGCTL-specific labels, CTA text, and step descriptions.
- [ ] Map Control API errors to clear UX messages (`deadline_expired`, `signature_failed`, `signer_mismatch`, insufficient staked, out-of-window).
- [ ] Extend telemetry payloads for SGCTL context while preserving existing event names.
- [ ] Extend Sentry context for SGCTL path.

Exit criteria:
- [ ] SGCTL-specific failures are understandable from UI and telemetry.
- [ ] No regression in existing telemetry events.

Validation:
- [ ] `pnpm lint`

---

### Commit 6: Tests + Documentation Finalization
Goal: lock behavior with tests and docs.

TODOs:
- [ ] Add/update SGCTL cases in:
  - `transaction-steps.test.ts`
  - `affordability.test.ts`
  - `cost-calculations.test.ts`
- [ ] Update `app/marketplace/DEPOSIT-DIALOG.md` with SGCTL phase and flows.
- [ ] Update `TELEMETRY.md` entries.
- [ ] Update `SENTRY.md` entries.

Exit criteria:
- [ ] SGCTL behavior is documented and covered by tests.
- [ ] Lint clean.

Validation:
- [ ] `pnpm lint`
- [ ] `pnpm vitest run app/marketplace/__tests__/`

## Per-Commit Review Checklist (Use After Every Commit)
- [ ] TODOs for that commit are complete.
- [ ] No behavior regression in miners flow.
- [ ] No behavior regression in GLW delegation flow.
- [ ] SGCTL path status is explicit (done/partial/not started).
- [ ] Lint is clean.
- [ ] Commit message clearly states scope and non-goals.

## Suggested PR Comment Structure
When posting progress on the PR, use:

1. Scope delivered in this commit.
2. TODO items checked in this commit.
3. Validation commands run and results.
4. Remaining TODOs for next commit.
5. Risks or blockers.

## Known Risks
1. Regional stake/available amount sources may differ between display and backend checks; backend remains source of truth.
2. Mint+stake path complexity is high; extracting shared logic is required to avoid drift.
3. SGCTL/GLW phase transitions depend on backend time windows and listing metadata freshness.

## Non-Goals
1. No backend API changes in this plan.
2. No redesign of non-marketplace flows.
3. No changes to mining-center purchase architecture.

## Definition of Done
- SGCTL launchpad rows are visible.
- Deposit dialog supports all required SGCTL entry paths.
- User can complete SGCTL delegation from each required starting balance state.
- Existing GLW/miner behavior remains intact.
- Tests and docs are updated.
- Lint is clean.
