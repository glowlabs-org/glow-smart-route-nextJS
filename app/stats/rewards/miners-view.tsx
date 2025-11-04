"use client";

import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

export function MinersView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  return <WalletsView type="miner" glwSpotPrice={glwSpotPrice} />;
}

