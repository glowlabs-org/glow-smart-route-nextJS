import { Navbar } from "../components/navbar";
import BuyGctlView from "./view";

export default function BuyGctlPage() {
  return (
    <>
      <Navbar
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
