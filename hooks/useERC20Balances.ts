import { useContracts } from "./useContracts";
import { BigNumber, Signer, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";

export type SYMBOLS = "GLOW" | "GCC" | "IMPACT POWER POINTS" | "USDG" | "USDC";

export enum GetBalanceError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
}

export const useER20Balances = ({
  symbol,
  signer,
}: {
  symbol: SYMBOLS;
  signer: ethers.providers.JsonRpcSigner | undefined | null;
}) => {
  const { usdg, glow, gcc, usdc, isReady } = useContracts(signer);
  const [usdcBalance, setUsdcBalance] = useState<BigNumber | null>(null);
  const [usdgBalance, setUsdgBalance] = useState<BigNumber | null>(null);
  const [glowBalance, setGlowBalance] = useState<BigNumber | null>(null);
  const [gccBalance, setGccBalance] = useState<BigNumber | null>(null);
  /**
   * @param getBalance ~ Returns the balance for the desired token
   * @return Result<BigNumber, GetBalanceError> ~ Returns the balance for the desired token
   */
  async function getBalance(): Promise<Result<BigNumber, GetBalanceError>> {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    const address = await signer.getAddress();

    switch (symbol) {
      case "GLOW":
        if (!glow) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
        return new Ok(await glow.balanceOf(address));

      case "GCC":
        if (!gcc) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
        return new Ok(await gcc.balanceOf(address));

      case "IMPACT POWER POINTS":
        if (!gcc) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
        return new Ok(await gcc.totalImpactPowerEarned(address));

      case "USDG":
        if (!usdg) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
        return new Ok(await usdg.balanceOf(address));

      case "USDC":
        if (!usdc) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);
        // return new Ok(await BigNumber.from(700000000000000));
        return new Ok(await usdc.balanceOf(address));
    }
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

  const setGccBalanceForSigner = async () => {
    if (!signer) return new Err(GetBalanceError.SIGNER_NOT_AVAILABLE);
    if (!gcc) return new Err(GetBalanceError.CONTRACTS_NOT_AVAILABLE);

    const address = await signer.getAddress();
    const balance = await gcc.balanceOf(address);
    setGccBalance(balance);
  };

  const refreshBalances = async () => {
    if (isReady) {
      getBalance();
      setUsdcBalanceForSigner();
      setUsdgBalanceForSigner();
      setGlowBalanceForSigner();
      setGccBalanceForSigner();
    }
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

  useEffect(() => {
    if (isReady) {
      setGccBalanceForSigner();
    }
  }, [isReady, gcc]);

  return {
    getBalance,
    isReady,
    usdcBalance,
    usdgBalance,
    setUsdgBalanceForSigner,
    setUsdcBalanceForSigner,
    refreshBalances,
    glowBalance,
    setGlowBalanceForSigner,
    gccBalance,
    setGccBalanceForSigner,
  };
};
