import { Header } from "@/components/header";
import BuyGctlView from "./view";

export default function BuyGctlPage() {
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
