# V2 Leaderboard Computation

This document tracks the current V2 leaderboard model.

## Points

V2 points come from ledger rows, not from weekly recomputation of V1 score formulas.

Authoritative sources:

- `points_ledger`
- `/points/balance`
- `/points/ledger`

Award sources:

- GLW delegation: 4 points per $1 protocol deposit delegated.
- sGCTL delegation: 16 points per $1 protocol deposit delegated.
- Miner purchases: 8 points per $1 purchased.
- Weekly streak: 100 points per consecutive active week, capped at 20 weeks.

Cutover:

- Staging uses protocol week 128 as the cutover boundary.
- Realtime awards only apply to events whose derived protocol week is strictly greater than the configured cutover week.
- Production cutover is TBD and must be configured before release.

## Impact

V2 impact is watts-based. Watts are allocated per funded farm.

Farm allocation buckets:

- 24% delegator bucket
- 56% regional GCTL staker bucket
- 6% delegator-referral bucket
- 14% staker-referral bucket

Fallbacks:

- Pre-V2 farms route 100% of watts to Foundation.
- Missing referral shares route to Foundation.
- Empty primary delegator or staker buckets route to Foundation.

## Legacy Archive

The old `/impact/glow-score` computation remains useful as an archive and for old debugging notes, but new V2 UI should not present the old emissions, steering, vault bonus, Glow Worth points, or multiplier formulas as active rules.
