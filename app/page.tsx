import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import View from "./buy/view";
import { Footer } from "./components/footer";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";

export const revalidate = 36;

export default async function Page() {

  let gccCirculatingSupply = "";
  let glowPrice = "";
  let earlyLiquidityCurrentPrice = "";
  let marketCap = "";
  let usdcRewardPool = "";
  let gccPrice = "";
  let impactPowerPrice = "";
  // let totalProtocolFeesLast30days = "";
  
  const glowStats = await getHeadlineStats();
    gccCirculatingSupply = glowStats.gccCirculatingSupply.toString()
    glowPrice = glowStats.glowPrice.toString()
    earlyLiquidityCurrentPrice = glowStats.earlyLiquidityPrice.toString()
    marketCap = glowStats.marketCap.toString()
    usdcRewardPool = glowStats.usdcRewardPool;
    gccPrice = glowStats.gccPrice.toString()
    impactPowerPrice = glowStats.impactPowerPointsPrice.toString()
    // totalProtocolFeesLast30days = glowStats.totalProtocolFeesLast30days.toString()
  
  const ethPriceInUSD = await getEthPriceInUSD();

  return (
    <div>
      <View
        gccCirculatingSupply={gccCirculatingSupply}
        glowPrice={glowPrice}
        earlyLiquidityCurrentPrice={earlyLiquidityCurrentPrice}
        marketCap={marketCap}
        ethPriceInUSD={ethPriceInUSD}
        usdcRewardPool={usdcRewardPool}
        gccPrice={gccPrice}
        impactPowerPrice={impactPowerPrice}
        // totalProtocolFeesLast30days={totalProtocolFeesLast30days}
      />
      <Footer />
    </div>
  );
}
