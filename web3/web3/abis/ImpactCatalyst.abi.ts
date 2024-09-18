import { parseAbi } from 'viem'
const minimalImpactCatalystAbi = [
    'function estimateUSDCCommitImpactPower(uint256 amount) external view returns (uint256)',
    'function estimateGCCCommitImpactPower(uint256 amount) external view returns (uint256)',
]

export const ImpactCatalystAbi = parseAbi(minimalImpactCatalystAbi)
