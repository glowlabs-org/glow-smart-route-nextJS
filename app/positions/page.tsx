import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";
import { Navbar } from "@/app/components/navbar";
import { PageWrapper } from "@/app/components/page-wrapper";
import PositionsView from "./view";
import { Error } from "@/components/loading";

export const revalidate = 36;

export default async function PositionsPage() {
  try {
    const [glowStats, ethPriceInUSD] = await Promise.all([
      getHeadlineStats(),
      getEthPriceInUSD(),
    ]);

    const glowPrice = glowStats.glowPrice.toString();
    const earlyLiquidityCurrentPrice = glowStats.earlyLiquidityPrice.toString();
    const marketCap = glowStats.marketCap.toString();
    const usdcRewardPool = glowStats.usdcRewardPool;

    return (
      <PageWrapper>
        <div className="min-h-screen bg-background">
          <Navbar
            glowPrice={glowPrice}
            earlyLiquidityCurrentPrice={earlyLiquidityCurrentPrice}
            marketCap={marketCap}
            ethPriceInUSD={ethPriceInUSD}
            usdcRewardPool={usdcRewardPool}
          />
          <PositionsView />
        </div>
      </PageWrapper>
    );
  } catch (error) {
    console.error("Error fetching data:", error);
    return (
      <Error message="Failed to load market data. Please check your connection and try again." />
    );
  }
}
