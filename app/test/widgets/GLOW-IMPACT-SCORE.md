# Glow Points

Glow Points reward actions that fund new solar farms and keep users active in the protocol.

## Point rules

### Immediate action points

These points are awarded from completed purchase/delegation events:

- **GLW delegation**: 4 points per $1 of protocol deposit delegated.
- **sGCTL delegation**: 16 points per $1 of protocol deposit delegated.
- **Miner purchases**: 8 points per $1 of miners purchased.

### Weekly streak points

Streak points are awarded once per protocol week when the wallet has qualifying activity:

- GLW delegation
- sGCTL delegation
- miner purchase
- at least $100 of GCTL staked during the week

The award is 100 points per consecutive active week, capped at 20 weeks.

### Watts

Watts are impact accounting, not spendable points. Each funded farm allocates watts to:

- delegators
- regional GCTL stakers
- delegator referrers
- staker referrers
- Foundation fallback buckets

Pre-V2 farms route all watts to Foundation because the V2 primary-bucket inputs do not exist reliably for those historical farms.

## Important details

- The legacy V1 score is archived after cutover.
- V2 points do not award for passive GLW holding.
- V2 points do not use the old emissions/steering/vault/Glow Worth multiplier formula.

## Example

Assume for a given week:

- GLW delegation protocol deposit: $250
- sGCTL delegation protocol deposit: $100
- Miner purchase: $50
- Active streak week: 3

Points:

- GLW delegation: \(250 * 4 = 1,000\)
- sGCTL delegation: \(100 * 16 = 1,600\)
- Miner purchase: \(50 * 8 = 400\)
- Weekly streak: \(3 * 100 = 300\)
- Total: 3,300 points
