"use client";

import { WalletsView } from "./wallets-view";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

export function DelegatorsView() {
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  return <WalletsView type="delegator" glwSpotPrice={glwSpotPrice} />;
}

