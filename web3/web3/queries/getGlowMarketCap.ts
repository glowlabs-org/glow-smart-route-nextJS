import { addresses } from "@/web3/constants/addresses";
import { hubGet } from "@/lib/api/hub-client";
import { getCurrentWeekNumber } from "@/lib/rewards/weekly-delegations";
import { getTotalMinerClaimed } from "@/web3/web3/queries/getTotalMinerClaimed";
import { formatUnits, parseAbi, PublicClient } from "viem";
const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

const ENDOWMENT_WALLET = "0x868D99B4a6e81b4683D10ea5665f13579A9d1607";
const TRADING_BOT_WALLET = "0x0b650820dde452b204de44885fc0fbb788fc5e37";

/**
 * The Market Cap Of Glow Is The Total Circulating Supply Of Glow Multiplied By The Current Price Of Glow
 * We need to exclude
 *  1. balance of the carbon credit auction
 *  2. balance of grants contract
 *  3. balance of veto council contract.
 *  4. balance of miner pool and gca contract
 *  5. the total amount of staked / locked tokens in the glow contract
 *  6. Early liquidity balance
 *  7. Vault balance (from CRM)
 *  8. Endowment balance
 *  9. Trading bot balance
 * @param glowPrice - The current price of glow in USD ($2.70) as an example
 *
 */
export async function getGlowMarketCap(
  glowPrice: number,
  publicClient: PublicClient
) {
  const totalSupplyCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "totalSupply",
  };
  const carbonCreditAuctionBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.carbonCreditAuction],
  };
  const grantsContractBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.grantsTreasury],
  };
  const vetoCouncilContractBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.vetoCouncilContract],
  };
  const minerPoolAndGcaContractBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.gcaAndMinerPoolContract],
  };

  const glowStakedOrLockedBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.glow],
  };

  const earlyLiquidityBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addresses.earlyLiquidity],
  };

  const endowmentBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [ENDOWMENT_WALLET],
  };
  const tradingBotBalanceCall = {
    address: addresses.glow,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [TRADING_BOT_WALLET],
  };

  const calls = [
    totalSupplyCall,
    carbonCreditAuctionBalanceCall,
    grantsContractBalanceCall,
    vetoCouncilContractBalanceCall,
    minerPoolAndGcaContractBalanceCall,
    glowStakedOrLockedBalanceCall,
    earlyLiquidityBalanceCall,
    endowmentBalanceCall,
    tradingBotBalanceCall,
  ];

  let multicall: Awaited<ReturnType<typeof publicClient.multicall>>;
  try {
    multicall = await publicClient.multicall({
      contracts: calls,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  let vaultBalanceResponse: { totalGlwDelegatedWei: string };
  try {
    vaultBalanceResponse = await hubGet<{ totalGlwDelegatedWei: string }>(
      "/fractions/total-actively-delegated"
    );
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  let totalMinerClaimedResponse: Awaited<
    ReturnType<typeof getTotalMinerClaimed>
  >;
  try {
    totalMinerClaimedResponse = await getTotalMinerClaimed();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  const results = (multicall as Array<{ result: unknown }>).map(
    (result, index) => {
      return {
        result: result.result as bigint,
        call: calls[index],
      };
    }
  );

  const [
    totalSupply,
    carbonCreditAuctionBalance,
    grantsContractBalance,
    vetoCouncilContractBalance,
    minerPoolAndGcaContractBalance,
    glowStakedOrLockedBalance,
    earlyLiquidityBalance,
    endowmentBalance,
    tradingBotBalance,
  ] = results;

  const vaultBalanceWei = BigInt(
    vaultBalanceResponse?.totalGlwDelegatedWei ?? "0"
  );

  const totalMinerClaimedGlow = BigInt(
    totalMinerClaimedResponse?.data?.totalGlowPayouts?.totalGlowPayouts ?? "0"
  );

  const currentWeek = getCurrentWeekNumber();
  const inflationToMinerPerWeek = 175_000;
  const totalAllocatedToMiners =
    BigInt(currentWeek * inflationToMinerPerWeek) * BigInt(1e18);
  const yetToBeClaimedFromMiners =
    totalAllocatedToMiners - totalMinerClaimedGlow;

  const circulatingSupply =
    totalSupply.result -
    carbonCreditAuctionBalance.result -
    grantsContractBalance.result -
    vetoCouncilContractBalance.result -
    minerPoolAndGcaContractBalance.result +
    yetToBeClaimedFromMiners -
    glowStakedOrLockedBalance.result -
    earlyLiquidityBalance.result -
    vaultBalanceWei -
    endowmentBalance.result -
    tradingBotBalance.result;
  const formattedTotalSupplyMinusRest = Number(
    formatUnits(circulatingSupply, 18)
  );
  const marketCap = formattedTotalSupplyMinusRest * glowPrice;
  return {
    circulatingSupply: formattedTotalSupplyMinusRest,
    marketCap,
    totalSupply: Number(formatUnits(totalSupply.result, 18)),
  };
}
