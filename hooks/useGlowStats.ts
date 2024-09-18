import { useContracts } from "./useContracts";
import { BigNumber, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";

export enum GlowStatsError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
}

export const useGlowStats = (circulatingSupply: string) => {
  const signer = useEthersSigner();
  const { earlyLiquidity, isReady } = useContracts(signer);
  const [glowPrice, setGlowPrice] = useState<string>("0");
  const [marketCap, setMarketCap] = useState<string>("0");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  /**
   * @return Result<BigNumber, GlowStatsError> ~ The amount of glow price for one increment
   */
  async function getGlowPrice(): Promise<Result<BigNumber, GlowStatsError>> {
    if (!earlyLiquidity) return new Err(GlowStatsError.CONTRACTS_NOT_AVAILABLE);
    setIsFetching(true);
    const glowPrice = await earlyLiquidity.getPrice(100);
    // console.log({ glowPrice: glowPrice.toString() });
    setGlowPrice(ethers.utils.formatUnits(glowPrice, 6));
    setIsFetching(false);
    setIsLoading(false);
    return new Ok(glowPrice);
  }

  useEffect(() => {
    if (Number(glowPrice) > 0) {
      setMarketCap(
        Math.floor(Number(glowPrice) * Number(circulatingSupply)).toString()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowPrice]);

  useEffect(() => {
    if (isReady) {
      getGlowPrice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return {
    isFetching,
    isLoading,
    glowPrice,
    getGlowPrice,
    marketCap,
  };
};
