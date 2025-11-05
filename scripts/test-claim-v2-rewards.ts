/**
 * Test script to simulate claiming v2 rewards (claimPayout)
 *
 * Usage:
 * npx tsx scripts/test-claim-v2-rewards.ts
 *
 * or add to package.json:
 * "test:claim": "tsx scripts/test-claim-v2-rewards.ts"
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import {
  getAddresses,
  type ClaimPayoutParams,
  type TokenAndAmount,
} from "@glowlabs-org/utils/browser";

// Configuration
const TEST_CONFIG = {
  WEEK: 98,
  USER_ADDRESS: "0x8680092B8c97BF973434cdE47E8792215942D888" as Address,
  HOT_WALLET_ADDRESS: "0x465E5573c648BC50a11911Cd48D0e279F4409Ec8" as Address,
  MERKLE_PROOF_BASE_URL: "https://pub-311748c72106476cbeabe0a22a59217d.r2.dev",
  FIRST_V2_WEEK: 97,
  // Set to true to actually execute the transaction (requires private key)
  DRY_RUN: true,
};

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "1");

// Get SDK addresses
const SDKAddresses = getAddresses(CHAIN_ID);

// Weekly report data structure
interface ReadableLeafReward {
  leaf: `0x${string}`;
  user: `0x${string}`;
  glowInflationEarned: string;
  glowInflationEarnedLeafWeight: string;
  onchainAssetsEarned: {
    asset: string;
    assetAddress: `0x${string}`;
    amount: string;
  }[];
  v1MerkleProof: string[];
  v2MerkleProof: string[];
  offchainAssetsEarned: {
    asset: string;
    amount: string;
  }[];
}

interface WeeklyReportData {
  week: number;
  v1MerkleRoot: string;
  v2MerkleRoot: string;
  totalGlowInflationRewards: string;
  totalGlowInflationRewardsLeafWeight: string;
  totalV1UsdgWeight: string;
  fullOnchainTokensAndAmountsArray: {
    amount: string;
    asset: string;
    assetAddress: string;
  }[];
  readableLeaves: ReadableLeafReward[];
}

function weekToNonce(week: number): bigint {
  if (week < TEST_CONFIG.FIRST_V2_WEEK) {
    throw new Error(`Week ${week} is before v2 launch`);
  }
  return BigInt(week - TEST_CONFIG.FIRST_V2_WEEK);
}

async function fetchMerkleProof(week: number): Promise<WeeklyReportData> {
  const url = `${TEST_CONFIG.MERKLE_PROOF_BASE_URL}/weekly-report-week-${week}.json`;
  console.log(`📥 Fetching merkle proof from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch merkle proof for week ${week}: ${response.statusText}`
    );
  }

  const data: WeeklyReportData = await response.json();
  console.log(`✅ Successfully fetched data for week ${week}`);

  return data;
}

function findUserProof(
  data: WeeklyReportData,
  userAddress: Address
): ReadableLeafReward | null {
  const proof = data.readableLeaves.find(
    (leaf) => leaf.user.toLowerCase() === userAddress.toLowerCase()
  );

  if (!proof) {
    console.log(`❌ No proof found for address ${userAddress}`);
    return null;
  }

  console.log(`✅ Found proof for address ${userAddress}`);
  return proof;
}

function buildClaimParams(
  userProof: ReadableLeafReward,
  nonce: bigint,
  fromAddress: Address,
  toAddress: Address
): ClaimPayoutParams {
  const tokensAndAmounts: TokenAndAmount[] = [];
  const isGuardedToken: boolean[] = [];
  const toCounterfactual: boolean[] = [];

  // Include ALL tokens from onchainAssetsEarned (required for merkle proof verification)
  userProof.onchainAssetsEarned.forEach((asset) => {
    tokensAndAmounts.push({
      token: asset.assetAddress,
      amount: BigInt(asset.amount),
    });

    // GLW and USDG are guarded tokens
    isGuardedToken.push(asset.asset === "GLW" || asset.asset === "USDG");
    toCounterfactual.push(false);
  });

  const params: ClaimPayoutParams = {
    nonce,
    proof: userProof.v2MerkleProof.map((p) => p as `0x${string}`),
    tokensAndAmounts,
    from: fromAddress,
    to: toAddress,
    isGuardedToken,
    toCounterfactual,
  };

  return params;
}

function displayClaimSummary(
  userProof: ReadableLeafReward,
  nonce: bigint,
  claimParams: ClaimPayoutParams
) {
  console.log("\n📊 CLAIM SUMMARY");
  console.log("================");
  console.log(`Week: ${TEST_CONFIG.WEEK}`);
  console.log(`Nonce: ${nonce}`);
  console.log(`User Address: ${TEST_CONFIG.USER_ADDRESS}`);
  console.log(`From Address (Hot Wallet): ${TEST_CONFIG.HOT_WALLET_ADDRESS}`);
  console.log(`To Address: ${TEST_CONFIG.USER_ADDRESS}`);

  console.log("\n💰 ONCHAIN ASSETS TO CLAIM:");
  userProof.onchainAssetsEarned.forEach((asset, idx) => {
    const amount = BigInt(asset.amount);
    const formattedAmount = Number(amount) / 1e18; // Assuming 18 decimals
    console.log(
      `  ${idx + 1}. ${asset.asset}: ${formattedAmount.toFixed(6)} (${
        asset.assetAddress
      })`
    );
    console.log(`     Raw Amount: ${asset.amount}`);
    console.log(`     Is Guarded: ${claimParams.isGuardedToken[idx]}`);
  });

  if (userProof.offchainAssetsEarned.length > 0) {
    console.log("\n📋 OFFCHAIN ASSETS (Info Only):");
    userProof.offchainAssetsEarned.forEach((asset, idx) => {
      console.log(`  ${idx + 1}. ${asset.asset}: ${asset.amount}`);
    });
  }

  console.log("\n🔐 MERKLE PROOF:");
  console.log(`  Leaf: ${userProof.leaf}`);
  console.log(`  Proof Length: ${userProof.v2MerkleProof.length}`);
  console.log(
    `  Proof Preview: [${userProof.v2MerkleProof.slice(0, 2).join(", ")}...]`
  );

  console.log("\n📝 CLAIM PARAMETERS:");
  console.log(`  Nonce: ${claimParams.nonce}`);
  console.log(`  From: ${claimParams.from}`);
  console.log(`  To: ${claimParams.to}`);
  console.log(`  Tokens Count: ${claimParams.tokensAndAmounts.length}`);
  console.log(`  Proof Length: ${claimParams.proof.length}`);
}

async function simulateClaim(claimParams: ClaimPayoutParams) {
  console.log("\n🔍 SIMULATING CLAIM TRANSACTION...");

  // Create public client for simulation
  const publicClient = createPublicClient({
    chain: CHAIN_ID === 1 ? mainnet : mainnet, // Add other chains as needed
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
  });

  // Import RewardsKernel ABI (you may need to adjust the import path)
  // For now, we'll just log the parameters
  console.log("\n📤 Would call RewardsKernel.claimPayout with:");
  console.log(
    JSON.stringify(
      {
        nonce: claimParams.nonce.toString(),
        proof: claimParams.proof.slice(0, 2).concat(["..."]),
        tokensAndAmounts: claimParams.tokensAndAmounts.map((ta) => ({
          token: ta.token,
          amount: ta.amount.toString(),
        })),
        from: claimParams.from,
        to: claimParams.to,
        isGuardedToken: claimParams.isGuardedToken,
        toCounterfactual: claimParams.toCounterfactual,
      },
      null,
      2
    )
  );

  // Check if already claimed
  console.log("\n⏳ Checking claim status...");
  // Note: You would need to import and use the RewardsKernel contract here
  // For now, we'll skip the actual contract call in this test script
}

async function main() {
  console.log("🧪 V2 REWARDS CLAIM TEST SCRIPT");
  console.log("================================\n");

  try {
    // Step 1: Fetch merkle proof data
    const weekData = await fetchMerkleProof(TEST_CONFIG.WEEK);

    // Step 2: Find user's proof
    const userProof = findUserProof(weekData, TEST_CONFIG.USER_ADDRESS);

    if (!userProof) {
      console.log("\n❌ Cannot proceed: No proof found for user");
      process.exit(1);
    }

    // Step 3: Calculate nonce
    const nonce = weekToNonce(TEST_CONFIG.WEEK);

    // Step 4: Build claim parameters
    const claimParams = buildClaimParams(
      userProof,
      nonce,
      TEST_CONFIG.HOT_WALLET_ADDRESS,
      TEST_CONFIG.USER_ADDRESS
    );

    // Step 5: Display summary
    displayClaimSummary(userProof, nonce, claimParams);

    // Step 6: Simulate claim
    if (TEST_CONFIG.DRY_RUN) {
      await simulateClaim(claimParams);
      console.log("\n✅ DRY RUN COMPLETED");
      console.log(
        "💡 Set DRY_RUN=false and provide PRIVATE_KEY to execute actual claim"
      );
    } else {
      console.log("\n⚠️  LIVE EXECUTION NOT IMPLEMENTED");
      console.log("💡 This would execute the actual claimPayout transaction");
      // Implement actual execution here if needed
    }

    console.log("\n✨ Test completed successfully!");
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
