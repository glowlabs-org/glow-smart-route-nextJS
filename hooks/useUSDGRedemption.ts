import { useEthersSigner } from "./useEthersSigner";
import { BigNumber, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";

import { formatUnits, erc20Abi } from "viem";
import { useContracts } from "./useContracts";
import { useEffect, useState } from "react";
import { publicClient } from "@/web3/web3/clients/publicClient";

// USDGRedemption contract address
export const USDG_REDEMPTION_ADDRESS =
  "0x1c2cA537757e1823400F857EdBe72B55bbAe0F08" as `0x${string}`;

// USDC contract address
const USDC_ADDRESS =
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}`;

// Minimal ABI for the exchange function
const USDG_REDEMPTION_ABI = ["function exchange(uint256 amountUSDG) external"];

export enum USDGRedemptionError {
  CONTRACT_NOT_AVAILABLE = "Contract not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
}

export function useUSDGRedemption() {
  const signer = useEthersSigner();
  const { usdg, usdc } = useContracts(signer);
  const [usdcInRedemption, setUsdcInRedemption] = useState<string>("-");

  useEffect(() => {
    async function fetchUsdcInRedemption() {
      await getUSDCBalanceOfRedemptionContract();
    }
    fetchUsdcInRedemption();
  }, []);

  // Returns a contract instance for USDGRedemption
  function getContract() {
    if (!signer) return undefined;
    return new ethers.Contract(
      USDG_REDEMPTION_ADDRESS,
      USDG_REDEMPTION_ABI,
      signer
    );
  }

  /**
   * Get USDC balance of the USDG Redemption contract
   * Uses publicClient so no wallet connection is required
   */
  async function getUSDCBalanceOfRedemptionContract(): Promise<BigNumber | null> {
    try {
      const balance = (await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [USDG_REDEMPTION_ADDRESS],
      })) as bigint;

      const formattedBalance = formatUnits(balance, 6);
      setUsdcInRedemption(formattedBalance);

      // Convert to BigNumber for compatibility with existing code
      return BigNumber.from(balance.toString());
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcInRedemption("-");
      return null;
    }
  }

  /**
   * Redeem USDG for USDC 1:1 using the exchange function
   * Handles allowance: if insufficient, approve MaxUint256 first
   * @param amountUSDG Amount of USDG to redeem (BigNumber, 6 decimals)
   */
  async function redeemUSDGForUSDC(
    amountUSDG: BigNumber
  ): Promise<Result<boolean, USDGRedemptionError | string>> {
    try {
      const contract = getContract();
      if (!contract) return new Err(USDGRedemptionError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);

      if (!usdg) return new Err("USDG contract not available");
      const owner = await signer.getAddress();
      const allowance: BigNumber = await usdg.allowance(
        owner,
        USDG_REDEMPTION_ADDRESS
      );

      if (allowance.lt(amountUSDG)) {
        // Approve MaxUint256 for gas efficiency
        try {
          const approveTx = await usdg.approve(
            USDG_REDEMPTION_ADDRESS,
            ethers.constants.MaxUint256
          );
          await approveTx.wait();
        } catch (e: any) {
          return new Err(e?.reason || e?.message || "USDG approval failed");
        }
      }

      const tx = await contract.exchange(amountUSDG);
      await tx.wait();
      return new Ok(true);
    } catch (error: any) {
      return new Err(
        error?.reason || error?.message || USDGRedemptionError.UNKNOWN_ERROR
      );
    }
  }

  /**
   * Estimate gas for redeeming USDG for USDC
   * @param amountUSDG Amount of USDG to redeem (BigNumber, 6 decimals)
   * @param ethPriceInUSD Current ETH price in USD (for cost estimation)
   */
  async function estimateGasForRedeemUSDG(
    amountUSDG: BigNumber,
    ethPriceInUSD: number | null
  ): Promise<Result<string, USDGRedemptionError | string>> {
    try {
      const contract = getContract();
      if (!contract) return new Err(USDGRedemptionError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      const gasPrice = await signer.getGasPrice();
      const estimatedGas = await contract.estimateGas.exchange(amountUSDG);
      const estimatedCost = estimatedGas.mul(gasPrice);
      if (ethPriceInUSD) {
        const estimatedCostInEth = ethers.utils.formatEther(estimatedCost);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (error: any) {
      return new Err(
        error?.reason || error?.message || USDGRedemptionError.UNKNOWN_ERROR
      );
    }
  }

  return {
    redeemUSDGForUSDC,
    estimateGasForRedeemUSDG,
    getUSDCBalanceOfRedemptionContract,
    usdcInRedemption,
  };
}
