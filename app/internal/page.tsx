import { Header } from "@/components/header";
import BuyGctlView from "./view";
import { notFound } from "next/navigation";

export default function BuyGctlPage() {
  return notFound();

  return (
    <>
      <Header
        withIsScrolled={false}
        glowPrice="0"
        earlyLiquidityCurrentPrice="0"
        marketCap="0"
        ethPriceInUSD={0}
        usdcRewardPool="0"
      />

      <BuyGctlView />
    </>
  );
}
