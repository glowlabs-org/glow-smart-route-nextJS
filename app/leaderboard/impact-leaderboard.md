# Glow Leaderboard - V2 Implementation Notes

This doc captures the V2 leaderboard behavior in `app/leaderboard/*`.

## What this feature is

- **Points ranking**: ranks wallets by V2 points earned from concrete protocol actions.
- **Watts ranking**: shows allocated watts, carbon credits, and policy credits from funded farms.
- **Legacy archive**: `GET /impact/glow-score` remains a read-only V1 archive after cutover and should not drive new UI behavior.

## V2 points rules

- GLW delegation: 4 points per $1 of protocol deposit delegated.
- sGCTL delegation: 16 points per $1 of protocol deposit delegated.
- Miner purchases: 8 points per $1 purchased.
- Weekly streak: 100 points per consecutive active week, capped at 20 weeks.

Passive GLW holding, old emissions points, old steering points, vault bonus points, Glow Worth points, and multipliers do not create new V2 points.

## V2 impact rules

Watts are allocated when a farm fully funds. The farm allocation model splits watts across:

- delegators
- regional GCTL stakers
- delegator referral bucket
- staker referral bucket
- Foundation fallback buckets

Pre-V2 farms route all watts to Foundation because the V2 primary-bucket inputs do not exist reliably for those historical farms. If an otherwise V2 primary bucket has no eligible recipients, the empty bucket also routes to Foundation.

## Endpoints

- `GET /points/balance`: wallet spendable balance and lifetime earned/spent totals.
- `GET /points/ledger`: source-level earned/spent rows.
- `GET /impact-v2/leaderboard`: V2 watts ranking.
- `GET /impact-v2/wallet/:wallet`: wallet V2 watts and bucket breakdown.
- `GET /impact-v2/farm/:farmId/allocation`: per-farm allocation detail.

Most numeric fields are stringified decimals or wei strings. Avoid `Number()` on wei; use `BigInt` and existing formatting helpers.

## UX rules

- Keep rank and percentile stable when the user filters/searches.
- Use ENS names where available, but keep wallet address search working.
- Keep points and watts visually separate; points are spendable/redeemable, watts are impact accounting.
- Do not describe the old V1 multiplier model in new leaderboard UI.

## Files

- `app/leaderboard/page.tsx`
- `app/leaderboard/view.tsx`
- `app/leaderboard/wallets-view.tsx`
- `app/leaderboard/farms-view.tsx`
- `app/leaderboard/wallet-impact-dialog.tsx`
- `components/dialogs/points-explainer-dialog.tsx`
- `components/dialogs/watts-breakdown-dialog.tsx`
- `hooks/v2-points.ts`
- `hooks/v2-impact.ts`
