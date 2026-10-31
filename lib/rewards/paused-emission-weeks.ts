// Weeks whose GLW emission claim cannot succeed on the current contracts.
//
// Week 149: the merkle root for MinerPool bucket 150 was submitted on-chain with
// a typo (one character dropped) and the bucket finalized on 2026-10-18 before
// anyone noticed, so the contract rejects every week 149 proof as
// InvalidProof. Protocol deposit rewards for the week are unaffected. These
// emissions become claimable once the Glow V2 contracts are redeployed.
export const PAUSED_EMISSION_WEEKS: ReadonlySet<number> = new Set([149]);

export function isEmissionClaimPaused(week: number): boolean {
  return PAUSED_EMISSION_WEEKS.has(week);
}
