import { useContracts } from "./useContracts";
import { BigNumber, Signer, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";

export type SYMBOLS = "GLOW" | "GCC" | "IMPACT POWER POINTS" | "USDG" | "USDC";

export enum SendTokensError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOW_ERROR = "Unknown error",
}

export const useERC20 = ({
  signer,
}: {
  signer: ethers.providers.JsonRpcSigner | undefined | null;
}) => {
  const { usdg, glow, gcc, usdc, isReady } = useContracts(signer);

  /**
   * @param sendTokens ~ send tokens to the desired address
   * @return Result<BigNumber, GetBalanceError> ~ Returns sucess or error
   */
  async function sendTokens(
    symbol: SYMBOLS,
    to: `0x${string}`,
    amount: BigNumber
  ): Promise<Result<boolean, SendTokensError>> {
    if (!signer) return new Err(SendTokensError.SIGNER_NOT_AVAILABLE);

    let tx;

    switch (symbol) {
      case "GLOW":
        if (!glow) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);
        tx = await glow.transfer(to, amount);

      case "GCC":
        if (!gcc) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);

        tx = await gcc.transfer(to, amount);

      case "USDG":
        if (!usdg) return new Err(SendTokensError.CONTRACTS_NOT_AVAILABLE);

        tx = await usdg.transfer(to, amount);
    }

    if (!tx) return new Err(SendTokensError.UNKNOW_ERROR);

    try {
      await tx.wait();
      return new Ok(true);
    } catch (error) {
      return new Err(SendTokensError.UNKNOW_ERROR);
    }
  }

  return {
    sendTokens,
    isReady,
  };
};
