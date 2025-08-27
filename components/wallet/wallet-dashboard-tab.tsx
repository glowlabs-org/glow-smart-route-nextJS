"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus } from "lucide-react";

interface Balances {
  usdc: string;
  usdg: string;
  glow: string;
  gctl: string;
}

interface GctlStakingSnapshot {
  wallet: string;
  staked: string;
  unstaking: string;
  isUnstaking: boolean;
}

interface WalletDashboardTabProps {
  isConnected: boolean;
  isWalletLoading: boolean;
  balancesLoading: boolean;
  balances: Balances;
  gctlStaking: GctlStakingSnapshot;
  onOpenStake: () => void;
  onOpenUnstake: () => void;
  onOpenRestake: () => void;
}

export function WalletDashboardTab({
  isConnected,
  isWalletLoading,
  balancesLoading,
  balances,
  gctlStaking,
  onOpenStake,
  onOpenUnstake,
  onOpenRestake,
}: WalletDashboardTabProps) {
  const hasUsdc = Number(balances.usdc.replace(/,/g, "")) > 0;
  const hasUsdg = Number(balances.usdg.replace(/,/g, "")) > 0;
  const hasGlow = Number(balances.glow.replace(/,/g, "")) > 0;
  const hasGctl =
    Number(balances.gctl.replace(/,/g, "")) > 0 ||
    Number(gctlStaking.staked.replace(/,/g, "")) > 0 ||
    Number(gctlStaking.unstaking.replace(/,/g, "")) > 0;

  const totalGctl = (
    Number(balances.gctl.replace(/,/g, "")) +
    Number(gctlStaking.staked.replace(/,/g, "")) +
    Number(gctlStaking.unstaking.replace(/,/g, ""))
  ).toLocaleString();

  return (
    <div className="space-y-4">
      {/* Balances Grid (no impact credits) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* USDC Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">USDC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${balances.usdc}</div>
          </CardContent>
        </Card>

        {/* USDG Card */}
        {(hasUsdg || true) && (
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">USDG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${balances.usdg}</div>
            </CardContent>
          </Card>
        )}

        {/* GLOW Card */}
        {(hasGlow || true) && (
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">GLOW</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balances.glow}</div>
            </CardContent>
          </Card>
        )}

        {/* GCTL Card */}
        {hasGctl && (
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">GCTL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">
                    Unstaked
                  </span>
                  <span className="font-semibold">{balances.gctl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Staked</span>
                  <span className="font-semibold text-green-600">
                    {gctlStaking.staked}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">
                    Unstaking
                  </span>
                  <span className="font-semibold text-orange-600">
                    {gctlStaking.unstaking}
                  </span>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  Non-transferable during Phase I
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* GCTL Staking Snapshot */}
      {(hasGctl || true) && (
        <Card className="mb-2">
          <CardHeader>
            <CardTitle>GCTL Staking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Total GCTL</div>
                <div className="text-2xl font-bold">{totalGctl}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Staked</div>
                <div className="text-2xl font-bold text-green-600">
                  {gctlStaking.staked}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Unstaking</div>
                <div className="text-2xl font-bold text-orange-600">
                  {gctlStaking.unstaking}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Unstaked</div>
                  <div className="font-semibold">{balances.gctl}</div>
                </div>
                {gctlStaking.isUnstaking && (
                  <Badge variant="secondary">Dripping 1%/wk</Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={onOpenStake}
                disabled={!isConnected || isWalletLoading || balancesLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Stake
              </Button>
              <Button
                variant="ghost"
                onClick={onOpenRestake}
                disabled={!isConnected || isWalletLoading || balancesLoading}
              >
                Restake
              </Button>
              <Button
                variant="outline"
                onClick={onOpenUnstake}
                className="ml-auto"
                disabled={!isConnected || isWalletLoading || balancesLoading}
              >
                <Minus className="w-4 h-4 mr-2" />
                Unstake
              </Button>
            </div>

            {gctlStaking.isUnstaking && (
              <div className="text-xs text-muted-foreground mt-3">
                An active unstake is in progress. New schedules will drip 1%
                weekly.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default WalletDashboardTab;
