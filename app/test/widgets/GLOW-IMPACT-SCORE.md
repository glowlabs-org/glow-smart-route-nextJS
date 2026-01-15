# Glow Impact Score

Glow Impact Score is a points system designed to reward the actions that most directly grow onchain climate impact—especially **steering via staked GCTL (sGCTL)**.

## Point rules

### Weekly rollover points (calculated on week rollover)

These points are computed at weekly rollover and then applied for that week:

- **Emissions earned**: +1 point per **GLW token earned in emission rewards** (via miners, delegations, or owning farms directly).
- **Steering (sGCTL)**: +3 points per **GLW token steered by staking GCTL** (steering comes from **GCTL staking**, not delegation).
- **Vault bonus (delegated GLW)**: +0.005 points per week per **GLW token currently delegated**.

### Weekly multiplier (calculated on week rollover)

Your Total Multiplier is the sum of your **Base Multiplier** plus your **Streak Bonus**.

1.  **Base Multiplier**:

    - **Standard**: **1×** (Default).
    - **Cash Miner Bonus**: **3×** (If you **bought a miner with cash** this week).

2.  **Streak Bonus (Impact Streak)**:
    - Earn **+0.25×** (or +25%) for every consecutive week you **increase your delegated GLW** **or** **buy a miner with cash**.
    - **Cap**: The bonus caps at **+1.0×** (after 4 consecutive weeks).
    - **Reset**: If you do neither in a week, the streak bonus resets to **0×**.

_(Formula: Total Multiplier = Base + Streak Bonus)_

### Continuous points (calculated continuously)

- **GLW Worth**: +0.001 points per week per **GLW token in the user’s “GLW Worth”**.

## Important details

- **Delegated GLW double-counts intentionally**:
  Delegated GLW contributes to **GLW Worth** (continuous) _and_ earns the **vault bonus** (+0.005/week) on rollover.
- The rollover system is meant to align incentives around “showing up every week” and making high-impact moves, while the continuous component rewards long-term accumulation.

## Example

Assume for a given week:

- GLW earned in emission rewards: **100 GLW**
- GLW steered via sGCTL: **200 GLW**
- Delegated GLW: **10,000 GLW**
- GLW Worth: **50,000 GLW**
- Bought a miner with cash this week: **Yes** (affects base multiplier only)
- Impact Streak: **4 weeks active** (Max streak)

Calculate base points (pre-multiplier):

- Emissions: \(100 × 1 = 100\)
- Steering: \(200 × 3 = 600\)
- Delegated (vault): \(10,000 × 0.005 = 50\)
- GLW Worth: \(50,000 × 0.001 = 50\)
- **Total base points**: \(100 + 600 + 50 + 50 = 800\)

Calculate Total Multiplier:

- Base (Cash Miner): **3.0×**
- Streak Bonus (4 weeks): **+1.0×**
- Total Multiplier: **4.0×**

Apply Multiplier to ALL points:

- **Total weekly points**: \(800 × 4.0 = 3,200\)

Breakdown after multiplier:

- Emissions points: \(100 × 4.0 = 400\)
- Steering points: \(600 × 4.0 = 2,400\)
- Vault points: \(50 × 4.0 = 200\)
- Worth points: \(50 × 4.0 = 200\)
