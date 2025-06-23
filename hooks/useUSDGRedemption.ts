import { useEthersSigner } from "./useEthersSigner";
import { BigNumber, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";

import { formatUnits } from "viem";
import { useContracts } from "./useContracts";
import { useEffect, useState } from "react";

// Hardcoded USDGRedemption contract address (replace with actual address when deployed)
export const USDG_REDEMPTION_ADDRESS =
  "0x1c2cA537757e1823400F857EdBe72B55bbAe0F08" as `0x${string}`;

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
  }, [usdc]);

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
   * Get USDG balance for the connected signer (for testing)
   */
  async function getUSDGBalanceForSigner(): Promise<BigNumber | null> {
    try {
      if (!usdg || !signer) return null;
      const address = await signer.getAddress();
      const balance: BigNumber = await usdg.balanceOf(address);
      return balance;
    } catch {
      return null;
    }
  }

  /**
   * Get USDC balance of the USDG Redemption contract
   */
  async function getUSDCBalanceOfRedemptionContract(): Promise<BigNumber | null> {
    try {
      console.log("usdc", usdc);
      if (!usdc) return null;
      console.log("usdc", usdc);
      const balance: BigNumber = await usdc.balanceOf(USDG_REDEMPTION_ADDRESS);
      setUsdcInRedemption(balance ? ethers.utils.formatUnits(balance, 6) : "-");
      return balance;
    } catch {
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
      console.log("allowance", formatUnits(allowance.toBigInt(), 6));
      console.log("amountUSDG", formatUnits(amountUSDG.toBigInt(), 6));
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
      console.log("redeeming", formatUnits(amountUSDG.toBigInt(), 6));
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
    getUSDGBalanceForSigner,
    getUSDCBalanceOfRedemptionContract,
    usdcInRedemption,
  };
}
