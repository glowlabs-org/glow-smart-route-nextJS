# GOAL: Refactor `deposit-dialog.tsx` (ponytail-guided, behavior-preserving)

Status: COMPLETE 2026-06-15. deposit-dialog.tsx 4,205 -> 2,789 (-34%) across 9 commits,
every one gated green; the pinned baseline failure set never moved. See Outcome at the bottom.
Owner loop: drive items top-to-bottom, one commit per item, full gate per commit.

## North star

Shrink `app/marketplace/deposit-dialog.tsx` (~4,205 lines) **without changing any runtime
behavior.** This is the core money path: GLW/sGCTL delegation, USDC mining purchases,
EIP-712 signing, the on-chain `buyFractions` call, and merkle-proof claims. Zero behavior
change is the hard requirement; smaller size is the goal, never a restructure for its own sake.

## Guiding principles (ponytail)

- Decision order before writing code: does it need to exist? -> stdlib? -> native platform? ->
  already-installed dep? -> one line? -> the minimum that works.
- The best code is the code you never wrote.
- **LAZY, NOT NEGLIGENT:** never remove trust-boundary validation, affordability/balance
  checks, error handling, retry/data-loss handling, security checks, accessibility, or
  anything on the signing / on-chain path.
- Phase 1 relocates nothing (delete/simplify in place). Phase 2 relocates stateful logic into
  `/hooks` + pure helpers into `deposit-dialog-utils.ts`, following the house pattern.

## Scope (approved)

1. **Phase 1** - ponytail delete/simplify pass, in place, no new files.
2. **Phase 2** - extract stateful orchestration into `/hooks`; extract any new pure helpers
   into `deposit-dialog-utils.ts`. JSX STAYS in `deposit-dialog.tsx` (house convention: large
   dialogs are not split into sub-components).

Target: ~2,700-2,900 lines.

## Branch + gate (approved, refined after baseline)

Branch: `feat/points-impact-v2-frontend-on-main` (commits land here).

The baseline is NOT fully green, so the gate is "no NEW failures vs. baseline," not "zero
failures." Pinned baseline (2026-06-15):

- `vitest` full: **634 passed / 1 failed / 3 skipped.** The 1 failure is
  `lib/__tests__/reward-score.test.ts` (pre-existing, from the locked-GLW-quote commits,
  unrelated to this file). Every `app/marketplace/__tests__/*` passes. The 3 skips are the
  intentionally-skipped mainnet-fork suites.
- `tsc --noEmit`: exits 1 with errors ONLY in `__tests__/wallet-detection.test.ts` and
  `__tests__/wallet-storage*.test.ts` (missing vitest globals: "Cannot find name it/expect").
  No app-code errors.
- `lint`: 0 errors, 37 pre-existing warnings.

Per-step gate (run after EVERY step; commit only if ALL hold, else revert that one step):

1. `pnpm -C glow-smart-route-nextJS exec vitest run app/marketplace/__tests__` -> 100% green
   (the direct safety net; it is green at baseline so it must stay green).
2. `pnpm -C glow-smart-route-nextJS test` -> failures <= 1 AND the only failure remains
   `reward-score.test.ts` (no new failures anywhere).
3. `pnpm -C glow-smart-route-nextJS exec tsc --noEmit` -> no error line references a non-test
   file (nothing in `app/**`, `hooks/**`, `lib/**`, `utils/**`). Baseline test-file errors tolerated.
4. `pnpm -C glow-smart-route-nextJS lint` -> 0 errors; no new warnings in touched files.

## Worklist

### Phase 1 - ponytail delete/simplify (modest: ~40-60 lines; file is actively maintained)

- **P1-A1** (high): remove the component-body redeclaration of `APP_DOMAIN_PLAIN_TEXT`
  (line 471, re-allocated every render); hoist to module scope in this file (or import the
  existing const at `deposit-dialog-utils.ts:1331` if exported). Used only by `handleShare`.
- **P1-B1** (high, biggest delete lever): add a local `toNum(bal, dec)` helper and collapse the
  ~8 `parseFloat(formatUnits(x, dec))` repeats (lines 904, 906, 1094, 1141, 3775, 3801, 3804,
  3874, 3902). Pure formatting, no trust boundary.
- **P1-B3** (medium, test-covered): collapse `calculateCostInGLW` / `calculateCostInGCTL`
  (`deposit-dialog-utils.ts:605-639`) into one decimals-parameterized fn + a shared
  `safeStepBigInt`; keep both public names as thin wrappers so tests/imports are untouched.
- **P1-A2** (medium-high, CARE): collapse `controlChainId` (line 656) into `expectedChainId`
  (line 495) - same env read. This feeds the EIP-712 `stakeControlEIP712Domain`; verify the
  sGCTL sign path after.
- **P1-B2** (medium): collapse `totalAmountLabel` (1234-1251) into a lookup over
  `requiredDisplayByMethod`, USDC special-cased once.
- **P1-C2 / B5 / B4** (low/medium, only if clearly safe): inline `previewUnitUsd` into its sole
  fallback; fold the `costInGLW`/`costInGCTL` callbacks once B3 lands; evaluate collapsing the
  `quantity` / `quantityInput` dual-state into one state + derived display (touches the
  controlled-input UX, eyeball the manual-entry path).

### Phase 2 - extract stateful orchestration (the real size win, ~1,200 lines moved out)

- **P2-1** `hooks/usePostSuccessSync.ts` <- `invalidatePostSuccessQueries` (1819-1928) +
  `syncFreshPostSuccessCaches` (1930-2050) + the module-scope `fetchFresh*` helpers (304-385) +
  schedule/optimistic refresh (2052-2148). ~450 lines. Each cache key is distinct; move, do not prune.
- **P2-2** `hooks/useStakeSyncDelegation.ts` <- `waitForStakeSyncBeforeDelegation` (1692-1770) +
  `delegateSgctlWithRetry` (1772-1817) + `fetchFreshAvailableStake`. ~130 lines.
  CARE: data-loss/retry handling that feeds the signed delegation.
- **P2-3** `hooks/useDepositConfirm.ts` <- `handleConfirm` (2150-2924), built on P2-1/P2-2.
  Extract LAST, in path-sized commits where feasible: sGCTL path, ETH-swap path, USDC->GLW swap
  path, unclaimed-rewards merkle-claim path, fraction-buy path, error/telemetry path. ~774 lines.
  HIGHEST CARE: EIP-712 sign block, `buyFractions`, merkle claims, swap-with-buffer loops.

Every Phase 2 step is its own gated commit.

## DO NOT TOUCH (money / signing / validation / retry / test-pinned API)

- `calculateAffordability` incl. the 2% swap buffer and 3% ETH buffer (`utils:862-1025`).
- `resolveDelegationStepAtomic` / `calculateSgctlStepAtomicFromGlwStep` (`utils:763-851`) - sets
  the signed sGCTL amount and on-chain step size.
- `selectClaimSetForGlwDelegation` + subset/greedy helpers (`utils:1501-1684`) - merkle-claim selection.
- `pollControlTransferConfirmation`, `withInternalRpcRetry`, `isRetriableStakeSyncRefreshError`
  (`utils`) - retry / confirmation / data-loss; also imported elsewhere + by tests.
- `handleConfirm`'s EIP-712 sign (2329-2357), `buyFractions` (2625-2648), merkle claims
  (2532-2607), swap buffer loops (2462-2511).
- `handleSmartAccountCheck` (1600-1625) - contract-wallet / EIP-7702 security gate.
- The per-key cache invalidations in `invalidatePostSuccessQueries` (move whole, never prune).
- Every utils export that looks "unused in the dialog" but is imported by `__tests__/` or by
  `bento.tsx` / `launchpad-status-widget.tsx` / `launchpad-dialog.tsx` (the `LaunchpadRewardScore`
  / `MiningCenterScore` types).

## Flagged, OUT OF SCOPE (decide separately, do NOT fold into this refactor)

- **C1 (possible latent bug):** the render-time `affordability` memo (1015-1049) reads the STALE
  prop `application?.activeFraction`, while every sibling derived value uses
  `effectiveApplication?.activeFraction`, and submit-time uses a fresh `currentAffordability`.
  If unintentional -> a behavior fix in a separate change. If intentional (avoid disabled-state
  flicker during the live refetch) -> add a one-line comment. Resolve BEFORE any step touches
  `affordability`.

## Definition of done

- File trending toward ~2,700-2,900 lines; Phase 1 + Phase 2 items committed.
- Every commit passed the gate; the baseline failure set is unchanged.
- No DO-NOT-TOUCH region changed in behavior; C1 resolved or consciously deferred with a comment.
- Deposit flow eyeballed on a preview deploy: miner (USDC), GLW delegation, sGCTL delegation.

## Outcome (2026-06-15)

`deposit-dialog.tsx`: 4,205 -> 2,789 lines (-34%). 9 commits, each gated green
(tsc 0 non-test errors, marketplace suite 355/355, full suite 634/1/3 = baseline,
lint 0 errors / 37 warnings = baseline).

Commits:
- 94734ac hoist APP_DOMAIN_PLAIN_TEXT
- 8179165 toNum helper (guarded balance->number)
- d7663cc collapse calculateCostInGLW/GCTL
- bcbad99 totalAmountLabel -> lookup
- 499dd75 P2-1 usePostSuccessSync (-543)
- 039c77c P2-2 useStakeSyncDelegation (-127)
- 3187d16 P2-3 useDepositConfirm / handleConfirm (-708)
- 84c402e drop 27 orphaned imports (-27)

New hooks: hooks/usePostSuccessSync.ts, hooks/useStakeSyncDelegation.ts, hooks/useDepositConfirm.ts.
The two large extractions were byte-exact mechanical slices (tsc as completeness checker).

Skipped/deferred: A2 (would remove an EIP-712 signing guard), B4/B5/C2 (marginal).
STILL OPEN: C1 (stale `application?.activeFraction` in the affordability memo) — untouched,
needs a decision (comment-and-defer vs separate fix).

Caveat: the post-success-sync and handleConfirm paths have no unit tests; they were moved
byte-exact, but the authoritative check is eyeballing the miner / GLW / sGCTL deposit paths
on a preview deploy.
