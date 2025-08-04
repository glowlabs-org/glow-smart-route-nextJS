import { useEffect, useState } from "react";
import {
  EarlyLiquidity,
  EarlyLiquidity__factory,
  GlowGuardedLaunch,
  GlowGuardedLaunch__factory,
  USDG,
  USDG__factory,
  addresses,
  ERC20,
  ERC20__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { ethers } from "ethers";
import { getAddresses } from "@glowlabs-org/utils/browser";

export function useContracts(
  signer: ethers.providers.JsonRpcSigner | undefined | null
) {
  const [earlyLiquidity, setEarlyLiquidity] = useState<
    EarlyLiquidity | undefined
  >();

  const [glow, setGlow] = useState<GlowGuardedLaunch | undefined>();
  const [usdg, setUSDG] = useState<USDG | undefined>();
  const [usdc, setUSDC] = useState<ERC20 | undefined>();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (signer) {
      if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
        throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
      }
      const SDKAddresses = getAddresses(
        parseInt(process.env.NEXT_PUBLIC_CHAIN_ID)
      );
      setEarlyLiquidity(
        EarlyLiquidity__factory.connect(addresses.earlyLiquidity, signer)
      );
      setGlow(GlowGuardedLaunch__factory.connect(SDKAddresses.GLW, signer));
      setUSDG(USDG__factory.connect(SDKAddresses.USDG, signer));

      setUSDC(ERC20__factory.connect(SDKAddresses.USDC, signer));
      setIsReady(true);
    }
  }, [signer]);

  return {
    earlyLiquidity,
    glow,
    usdg,
    usdc,

    isReady,
  };
}
