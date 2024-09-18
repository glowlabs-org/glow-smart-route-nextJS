import { useContracts } from "./useContracts";
import { BigNumber, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { useEthersSigner } from "./useEthersSigner";
type ApiRes = {
  estimate: {
    amountUSDCNeededNumber: number;
    amountUSDCNeededBigNumber: string;
    expectedImpactPointsBigNumber: string;
    expectedImpactPointsNumber: number;
  };
};

export enum PurchaseImpactPointError {
  INSUFFICIENT_USDG_BALANCE = "Insufficient USDG balance",
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
}

export const usePurchaseImpactPower = () => {
  const signer = useEthersSigner();
  const { usdg, gcc, impactCatalyst } = useContracts(signer);

  /**
   * @param amountUSDGToSpend ~ The amount of USDG to spend
   * @return Result<BigNumber, PurchaseImpactPointError> ~ The amount of impact points that can be bought (12 decimals)
   */
  async function estimateUSDGToImpactPoints({
    amountUSDGToSpend,
  }: {
    amountUSDGToSpend: BigNumber;
  }): Promise<Result<BigNumber, PurchaseImpactPointError>> {
    if (!impactCatalyst)
      return new Err(PurchaseImpactPointError.CONTRACTS_NOT_AVAILABLE);
    const estimate =
      await impactCatalyst.estimateUSDCCommitImpactPower(amountUSDGToSpend);
    return new Ok(estimate);
  }

  /**
   *
   * @param amountUSDGToSpend ~ The amount of USDG to spend
   * @param minimumImpactPowerToBuy ~ The minimum amount of impact points to buy
   */
  async function purchaseImpactPoints({
    amountUSDGToSpend,
    minimumImpactPowerToBuy,
  }: {
    amountUSDGToSpend: BigNumber;
    minimumImpactPowerToBuy: BigNumber;
  }): Promise<Result<boolean, PurchaseImpactPointError>> {
    if (!usdg) return new Err(PurchaseImpactPointError.CONTRACTS_NOT_AVAILABLE);
    if (!gcc) return new Err(PurchaseImpactPointError.CONTRACTS_NOT_AVAILABLE);
    if (!signer)
      return new Err(PurchaseImpactPointError.CONTRACTS_NOT_AVAILABLE);
    const address = await signer.getAddress();
    const balance = await usdg.balanceOf(address);
    if (balance.lt(amountUSDGToSpend)) {
      return new Err(PurchaseImpactPointError.INSUFFICIENT_USDG_BALANCE);
    }
    const allowance = await usdg.allowance(address, gcc.address);
    if (allowance.lt(amountUSDGToSpend)) {
      const tx = await usdg.approve(gcc.address, ethers.constants.MaxUint256);
      await tx.wait();
    }

    const tx = await gcc["commitUSDC(uint256,address,uint256)"](
      amountUSDGToSpend,
      address,
      minimumImpactPowerToBuy
    );
    await tx.wait();

    return Ok(true);
  }

  return {
    purchaseImpactPoints,
    estimateUSDGToImpactPoints,
  };
};
