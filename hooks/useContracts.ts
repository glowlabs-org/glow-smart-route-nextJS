import { useEffect, useState } from "react";
import { useEthersSigner } from "./useEthersSigner";
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
  GCCGuardedLaunch,
  GCCGuardedLaunch__factory,
  ImpactCatalyst,
  ImpactCatalyst__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { ethers } from "ethers";

export function useContracts(
  signer: ethers.providers.JsonRpcSigner | undefined | null
) {
  const [earlyLiquidity, setEarlyLiquidity] = useState<
    EarlyLiquidity | undefined
  >();

  const [glow, setGlow] = useState<GlowGuardedLaunch | undefined>();
  const [usdg, setUSDG] = useState<USDG | undefined>();
  const [gcc, setGCC] = useState<GCCGuardedLaunch | undefined>();
  const [usdc, setUSDC] = useState<ERC20 | undefined>();
  const [impactCatalyst, setImpactCatalyst] = useState<
    ImpactCatalyst | undefined
  >();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (signer) {
      setEarlyLiquidity(
        EarlyLiquidity__factory.connect(addresses.earlyLiquidity, signer)
      );
      setGlow(GlowGuardedLaunch__factory.connect(addresses.glow, signer));
      setUSDG(USDG__factory.connect(addresses.usdg, signer));
      setGCC(GCCGuardedLaunch__factory.connect(addresses.gcc, signer));
      setImpactCatalyst(
        ImpactCatalyst__factory.connect(addresses.impactCatalyst, signer)
      );

      setUSDC(
        ERC20__factory.connect(
          `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
          signer
        )
      );
      setIsReady(true);
    }
  }, [signer]);

  return {
    earlyLiquidity,
    glow,
    usdg,
    usdc,
    gcc,
    impactCatalyst,
    isReady,
  };
}
