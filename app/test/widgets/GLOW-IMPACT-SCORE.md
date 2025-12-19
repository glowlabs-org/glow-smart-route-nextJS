# Glow Impact Score

Glow Impact Score is a points system designed to reward the actions that most directly grow onchain climate impact—especially **steering via staked GCTL (sGCTL)**.

## Point rules

### Weekly rollover points (calculated on week rollover)

These points are computed at weekly rollover and then applied for that week:

- **Emissions earned**: +1 point per **GLW token earned in emission rewards** (via miners, delegations, or owning farms directly).
- **Steering (sGCTL)**: +3 points per **GLW token steered by staking GCTL** (steering comes from **GCTL staking**, not delegation).
- **Vault bonus (delegated GLW)**: +0.005 points per week per **GLW token currently delegated**.

### Weekly multiplier (calculated on week rollover)

- **Cash miner bonus**: Weeks where the user **bought a miner with cash** get a **3× multiplier** applied to **all weekly rollover points** for that week.

### Continuous points (calculated continuously)

- **GLW Worth**: +0.001 points per week per **GLW token in the user’s “GLW Worth”**.

## Important details

- **Delegated GLW double-counts intentionally**:

  Delegated GLW contributes to **GLW Worth** (continuous) *and* earns the **vault bonus** (+0.005/week) on rollover.
- The rollover system is meant to align incentives around “showing up every week” and making high-impact moves, while the continuous component rewards long-term accumulation.

## Example

Assume for a given week:

- GLW earned in emission rewards: **100 GLW**
- GLW steered via sGCTL: **200 GLW**
- Delegated GLW: **10,000 GLW**
- GLW Worth: **50,000 GLW**
- Bought a miner with cash this week: **Yes**

Weekly rollover points (pre-multiplier):

- Emissions: \(100 × 1 = 100\)
- Steering: \(200 × 3 = 600\)
- Delegated (vault): \(10,000 × 0.005 = 50\)
- Total rollover points: \(100 + 600 + 50 = 750\)

Apply 3× weekly multiplier:

- Weekly rollover points: \(750 × 3 = 2,250\)

Continuous rate:

- GLW Worth: \(50,000 × 0.001 = 50\) points per week (continuous)


