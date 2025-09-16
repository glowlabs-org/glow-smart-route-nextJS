import { useContracts } from "./useContracts";

import { Result, Ok, Err } from "ts-results";

import { JsonRpcSigner } from "ethers";

export type SYMBOLS = "GLOW" | "GCC" | "IMPACT POWER POINTS" | "USDG" | "USDC";

export enum SendTokensError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOW_ERROR = "Unknown error",
}

export const useERC20 = ({
  signer,
}: {
  signer: JsonRpcSigner | undefined | null;
}) => {
  const { usdg, glow, usdc, isReady } = useContracts(signer);

  /**
   * @param sendTokens ~ send tokens to the desired address
   * @return Result<BigNumber, GetBalanceError> ~ Returns sucess or error
   */
  async function sendTokens(
    symbol: SYMBOLS,
    to: `0x${string}`,
    amount: bigint
  ): Promise<Result<boolean, SendTokensError>> {
    console.log("signer", signer);
    if (!signer) return new Err(SendTokensError.SIGNER_NOT_AVAILABLE);

    let tx;
    console.log("symbol", symbol);
    switch (symbol) {
      case "GLOW":
        console.log("glow", glow);
        if (!glow) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);
        tx = await glow.transfer(to, amount);
        break;

      case "USDG":
        console.log("usdg", usdg);
        if (!usdg) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);
        tx = await usdg.transfer(to, amount);
        break;
      case "USDC":
        console.log("usdc", usdc);
        if (!usdc) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);
        tx = await usdc.transfer(to, amount);
        break;
    }

    if (!tx) return new Err(SendTokensError.UNKNOW_ERROR);

    try {
      await tx.wait();
      return new Ok(true);
    } catch (error) {
      console.error("error", error);
      return new Err(SendTokensError.UNKNOW_ERROR);
    }
  }

  return {
    sendTokens,
    isReady,
  };
};
