import { TrendingUp, Users, DollarSign, Coins, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EconomyOverviewProps {
  gctlCirculatingSupplyNumber: number;
  isGctlCirculatingSupplyLoading?: boolean;
  glwCirculatingSupply: number;
  glwMarketCap: number;
  totalGlwDelegated: number;
  percentGlwDelegated: number;
  usdcLiquidity: number;
  glwInPool: number;
  isGlwDataLoading?: boolean;
  gctlPriceNumber: number;
  totalStakedGctl: number;
  gctlHoldersCount: number;
  isGctlDataLoading?: boolean;
}

export function EconomyOverview({
  gctlCirculatingSupplyNumber,
  isGctlCirculatingSupplyLoading,
  glwCirculatingSupply,
  glwMarketCap,
  totalGlwDelegated,
  percentGlwDelegated,
  usdcLiquidity,
  glwInPool,
  isGlwDataLoading,
  gctlPriceNumber,
  totalStakedGctl,
  gctlHoldersCount,
  isGctlDataLoading,
}: EconomyOverviewProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Economy Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Macro health, participation, and reward flows
          </p>
        </div>
      </div>

      {/* Group 1: GLW Supply & Liquidity */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">GLW Supply & Liquidity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GLW Circulating Market Cap
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading
                  ? "--"
                  : `$${(glwMarketCap / 1_000_000).toFixed(1)}M`}
              </div>
              <div className="text-xs text-muted-foreground">
                Circulating:{" "}
                {isGlwDataLoading
                  ? "--"
                  : `${glwCirculatingSupply.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} GLW`}
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  % of GLW Delegated
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading ? "--" : `${percentGlwDelegated.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlwDataLoading
                  ? "--"
                  : `${totalGlwDelegated.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} delegated / ${glwCirculatingSupply.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 0,
                      }
                    )} circulating`}
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  USDC Liquidity (Uniswap)
                </div>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGlwDataLoading
                  ? "--"
                  : `$${usdcLiquidity.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                      currency: "USD",
                    })}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlwDataLoading
                  ? "--"
                  : `Pool GLW: ${glwInPool.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`}
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Endowment Value
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">-</div>
              <div className="text-xs text-muted-foreground">
                All assets combined
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group 2: GCTL Supply & Participation */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          GCTL Supply & Participation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Number of GCTL Tokens
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading || isGctlCirculatingSupplyLoading
                  ? "--"
                  : gctlCirculatingSupplyNumber.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
              </div>
              <div className="text-xs text-muted-foreground">
                Minted to date
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GCTL Market Cap
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading
                  ? "--"
                  : `$${(
                      gctlCirculatingSupplyNumber * gctlPriceNumber
                    ).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                      currency: "USD",
                    })}`}
              </div>
              <div className="text-xs text-muted-foreground">
                Based on mint price
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  % of GCTL Staked
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading || gctlCirculatingSupplyNumber === 0
                  ? "--"
                  : `${(
                      (totalStakedGctl / gctlCirculatingSupplyNumber) *
                      100
                    ).toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGctlDataLoading
                  ? "--"
                  : `${totalStakedGctl.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} staked / ${gctlCirculatingSupplyNumber.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 0,
                      }
                    )} outstanding`}
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GCTL Holders
                </div>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {isGctlDataLoading ? "--" : gctlHoldersCount.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Active participants
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group 3: Yield & Flows */}
      {/* <div>
        <h3 className="text-lg font-semibold mb-4">Yield & Flows</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Average Delegator APY
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">22.8%</div>
              <div className="text-xs text-muted-foreground">
                Time-weighted, region-weighted
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  Average Miner APY
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">18.5%</div>
              <div className="text-xs text-muted-foreground">
                All active miners
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  GLW/week → Delegators
                </div>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">120,500</div>
              <div className="text-xs text-muted-foreground">
                68.9% of 175k total
              </div>
            </CardContent>
          </Card>

          <Card className="">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  USDC/week → Miners
                </div>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-2">54,500</div>
              <div className="text-xs text-muted-foreground">
                31.1% of 175k total
              </div>
            </CardContent>
          </Card>
        </div>
      </div> */}
    </div>
  );
}
