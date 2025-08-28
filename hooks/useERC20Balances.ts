import { useContracts } from "./useContracts";
import { Result, Ok, Err } from "ts-results";

import { useEffect, useState } from "react";
import { JsonRpcSigner } from "ethers";

export type SYMBOLS = "GLOW" | "IMPACT POWER POINTS" | "USDG" | "USDC";

export enum GetBalanceError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
}

export const useER20Balances = ({
  signer,
}: {
  signer: JsonRpcSigner | undefined | null;
}) => {
  const { usdg, glow, usdc, isReady } = useContracts(signer);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [usdgBalance, setUsdgBalance] = useState<bigint | null>(null);
  const [glowBalance, setGlowBalance] = useState<bigint | null>(null);

  /**
   * @param getBalance ~ Returns the balance for the desired token
   * @return Result<BigNumber, GetBalanceError> ~ Returns the balance for the desired token
   */
  async function getBalances(): Promise<
    Result<{ glow: bigint; usdg: bigint; usdc: bigint }, GetBalanceError>
  > {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    const address = await signer.getAddress();
    if (!glow || !usdg || !usdc)
      return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
    const [g, u, c] = await Promise.all([
      glow.balanceOf(address),
      usdg.balanceOf(address),
      usdc.balanceOf(address),
    ]);
    return new Ok({ glow: g, usdg: u, usdc: c });
  }

  const setUsdcBalanceForSigner = async () => {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    if (!usdc) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);

    const address = await signer.getAddress();
    const balance = await usdc.balanceOf(address);
    setUsdcBalance(balance);
  };

  const setUsdgBalanceForSigner = async () => {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    if (!usdg) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);

    const address = await signer.getAddress();
    const balance = await usdg.balanceOf(address);
    setUsdgBalance(balance);
  };

  const setGlowBalanceForSigner = async () => {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    if (!glow) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);

    const address = await signer.getAddress();
    const balance = await glow.balanceOf(address);
    setGlowBalance(balance);
  };

  const refreshBalances = async () => {
    if (!isReady) return;
    await Promise.all([
      setUsdcBalanceForSigner(),
      setUsdgBalanceForSigner(),
      setGlowBalanceForSigner(),
    ]);
  };

  useEffect(() => {
    if (isReady) {
      setUsdcBalanceForSigner();
    }
  }, [isReady, usdc]);

  useEffect(() => {
    if (isReady) {
      setUsdgBalanceForSigner();
    }
  }, [isReady, usdg]);

  useEffect(() => {
    if (isReady) {
      setGlowBalanceForSigner();
    }
  }, [isReady, glow]);

  return {
    getBalances,
    isReady,
    usdcBalance,
    usdgBalance,
    setUsdgBalanceForSigner,
    setUsdcBalanceForSigner,
    refreshBalances,
    glowBalance,
    setGlowBalanceForSigner,
  };
};
