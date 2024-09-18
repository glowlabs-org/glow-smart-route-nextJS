import { BigNumber, ethers } from "ethers";
import { useContracts } from "./useContracts";
import { useEthersSigner } from "./useEthersSigner";
import { Result, Ok, Err } from "ts-results";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

export enum SwapUSDCToUSDGError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
  INSUFFICIENT_USDC_BALANCE = "Insufficient USDC balance",
}
export const useSwapUSDCToUSDG = () => {
  const signer = useEthersSigner();
  const { usdc, usdg } = useContracts(signer);

  const estimateGasForswapUSDCToUSDG = async (
    amount: BigNumber,
    ethPriceInUSD: number | null
  ): Promise<Result<string, string>> => {
    try {
      if (!usdc || !usdg)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);
      const signerAddress = await signer.getAddress();
      const usdcGasPrice = await usdc.provider.getGasPrice();

      const allowance = await usdc.allowance(signerAddress, usdg.address);
      let totalEstimatedGas = BigNumber.from(0);
      if (allowance.lt(amount)) {
        const estimatedGas = await usdc.estimateGas.approve(
          usdg.address,
          amount
        );

        const estimatedCost = estimatedGas.mul(usdcGasPrice);
        totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
      }

      const estimatedGas = BigNumber.from(100000);

      const estimatedCost = estimatedGas.mul(usdcGasPrice);
      totalEstimatedGas = totalEstimatedGas.add(estimatedCost);

      if (ethPriceInUSD) {
        const estimatedCostInEth = ethers.utils.formatEther(totalEstimatedGas);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (e: any) {
      return new Err(SwapUSDCToUSDGError.UNKNOWN_ERROR);
    }
  };

  const swapUSDCToUSDG = async (
    amount: BigNumber
  ): Promise<Result<boolean, SwapUSDCToUSDGError>> => {
    try {
      if (!usdc || !usdg)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);
      const signerAddress = await signer.getAddress();

      const allowance = await usdc.allowance(signerAddress, usdg.address);
      if (allowance.lt(amount)) {
        const tx = await usdc.approve(usdg.address, amount);
        await tx.wait();
      }

      const tx = await usdg.swap(signerAddress, amount);
      await tx.wait();
      return new Ok(true);
    } catch (e: any) {
      return new Err(SwapUSDCToUSDGError.UNKNOWN_ERROR);
    }
  };

  return { swapUSDCToUSDG, estimateGasForswapUSDCToUSDG };
};
