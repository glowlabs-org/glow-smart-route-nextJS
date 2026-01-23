"use client";

import * as React from "react";
import { useChainId } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConnectButton } from "@/components/connect-button";
import { FeatureLaunchModal } from "@/components/referral/feature-launch-modal";
import { ActivationCelebrationModal } from "@/components/referral/activation-celebration-modal";
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import { ChangeReferrerDialog } from "@/components/referral/change-referrer-dialog";

const MOCK_WALLET = "0x8Ba1f109551bD432803012645Ac136ddd64DBA72";
const MOCK_REFERRER = "0x6fC9E1b41c1f4D0a9B84cA6CF8999E6aB74C8E2F";

export default function ReferralTestPage() {
  const chainId = useChainId();
  const isSepolia = chainId === 11155111;

  const [isFeatureLaunchOpen, setIsFeatureLaunchOpen] = React.useState(false);
  const [isActivationOpen, setIsActivationOpen] = React.useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = React.useState(false);
  const [isChangeOpen, setIsChangeOpen] = React.useState(false);

  const [hasReferrer, setHasReferrer] = React.useState(true);
  const [canChangeReferrer, setCanChangeReferrer] = React.useState(true);
  const [bonusActive, setBonusActive] = React.useState(true);
  const [activationAwarded, setActivationAwarded] = React.useState(true);

  const [isLinking, setIsLinking] = React.useState(false);
  const [linkError, setLinkError] = React.useState<Error | null>(null);
  const [isChanging, setIsChanging] = React.useState(false);

  const mockStatus = React.useMemo(
    () => ({
      nonce: "12",
      canClaim: true,
      hasReferrer,
      referrer: hasReferrer
        ? {
            wallet: MOCK_REFERRER,
            ensName: "julien.eth",
            linkedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            gracePeriodEndsAt: new Date(
              Date.now() + 4 * 24 * 60 * 60 * 1000
            ).toISOString(),
            isInGracePeriod: canChangeReferrer,
            canChangeReferrer,
          }
        : undefined,
      bonus: bonusActive
        ? {
            isActive: true,
            endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            weeksRemaining: 9,
            bonusPercent: 10,
          }
        : undefined,
    }),
    [bonusActive, canChangeReferrer, hasReferrer]
  );

  const mockNetwork = React.useMemo(
    () => ({
      walletAddress: MOCK_WALLET,
      code: "julien",
      shareableLink: "https://app.glow.org/r/julien",
      stats: {
        totalReferees: 4,
        activeReferees: 2,
        pendingReferees: 1,
        activationPendingReferees: 1,
        totalPointsEarnedScaled6: "45200",
        thisWeekPointsScaled6: "3200",
        projectedThisWeekPointsScaled6: "5400",
        lifetimePointsScaled6: "45200",
        currentTier: {
          name: "Zenith",
          percent: 10,
          nextTier: {
            name: "Eclipse Prime",
            referralsNeeded: 2,
            percent: 15,
          },
        },
      },
      projectionWeekNumber: 212,
      referees: [
        {
          refereeWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          ensName: "sam.eth",
          status: "active",
          linkedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          activatedAt: new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
          thisWeekPointsScaled6: "2200",
          lifetimePointsScaled6: "21000",
          projectedThisWeekPointsScaled6: "2800",
          activationPending: false,
          gracePeriodEndsAt: new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
          isInGracePeriod: false,
        },
        {
          refereeWallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
          ensName: "maya.eth",
          status: "pending",
          linkedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          thisWeekPointsScaled6: "800",
          lifetimePointsScaled6: "800",
          projectedThisWeekPointsScaled6: "1200",
          activationPending: true,
          gracePeriodEndsAt: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000
          ).toISOString(),
          isInGracePeriod: true,
        },
        {
          refereeWallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          status: "inactive",
          linkedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          thisWeekPointsScaled6: "0",
          lifetimePointsScaled6: "5200",
          projectedThisWeekPointsScaled6: "0",
          activationPending: false,
          gracePeriodEndsAt: new Date(
            Date.now() - 83 * 24 * 60 * 60 * 1000
          ).toISOString(),
          isInGracePeriod: false,
        },
      ],
    }),
    []
  );

  const mockValidateCode = React.useCallback(async (code: string) => {
    if (code.trim().length < 3) {
      return { valid: false, message: "Code must be at least 3 characters" };
    }
    if (code.toLowerCase().includes("bad")) {
      return { valid: false, message: "Invalid referral code" };
    }
    return {
      valid: true,
      referrerWallet: MOCK_REFERRER,
      referrerEns: "julien.eth",
    };
  }, []);

  const mockLinkReferrer = React.useCallback(async (code: string) => {
    setLinkError(null);
    setIsLinking(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (code.toLowerCase().includes("error")) {
      const error = new Error("Simulated network error");
      setLinkError(error);
      setIsLinking(false);
      throw error;
    }
    setIsLinking(false);
  }, []);

  const mockChangeReferrer = React.useCallback(async () => {
    setIsChanging(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setIsChanging(false);
  }, []);

  if (!isSepolia) {
    return (
      <div className="min-h-screen bg-muted/40 text-foreground">
        <div className="max-w-3xl mx-auto p-6">
          <Card className="border border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle>Referral UI Lab</CardTitle>
              <div className="text-sm text-muted-foreground">
                Switch to Sepolia (11155111) to access this test page.
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Referral QA
            </div>
            <h1 className="text-2xl font-bold">Referral UI Lab</h1>
          </div>
          <ConnectButton variant="default" />
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Button onClick={() => setIsFeatureLaunchOpen(true)}>
                Open Feature Launch Modal
              </Button>
              <Button onClick={() => setIsActivationOpen(true)}>
                Open Activation Celebration
              </Button>
              <Button onClick={() => setIsNetworkOpen(true)}>
                Open Referral Network
              </Button>
              <Button onClick={() => setIsChangeOpen(true)}>
                Open Change Referrer
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <Label htmlFor="mock-has-referrer" className="text-sm">
                  Has referrer
                </Label>
                <Switch
                  id="mock-has-referrer"
                  checked={hasReferrer}
                  onCheckedChange={setHasReferrer}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <Label htmlFor="mock-can-change" className="text-sm">
                  Grace period active
                </Label>
                <Switch
                  id="mock-can-change"
                  checked={canChangeReferrer}
                  onCheckedChange={setCanChangeReferrer}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <Label htmlFor="mock-bonus" className="text-sm">
                  Bonus active
                </Label>
                <Switch
                  id="mock-bonus"
                  checked={bonusActive}
                  onCheckedChange={setBonusActive}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <Label htmlFor="mock-activation" className="text-sm">
                  Activation awarded
                </Label>
                <Switch
                  id="mock-activation"
                  checked={activationAwarded}
                  onCheckedChange={setActivationAwarded}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: use codes containing "bad" to see validation errors or
              "error" to simulate link failures.
            </div>
          </CardContent>
        </Card>
      </div>

      <FeatureLaunchModal
        mock={{
          open: isFeatureLaunchOpen,
          onOpenChange: setIsFeatureLaunchOpen,
          status: {
            canClaim: true,
            hasReferrer: false,
            featureLaunchModal: { seen: false },
          },
          validateCode: mockValidateCode,
          linkReferrer: mockLinkReferrer,
          isLinking,
          linkError,
          walletAddress: MOCK_WALLET,
        }}
      />

      <ActivationCelebrationModal
        mock={{
          open: isActivationOpen,
          onOpenChange: setIsActivationOpen,
          status: {
            activationBonus: {
              awarded: activationAwarded,
              celebrationSeen: false,
            },
          },
          walletAddress: MOCK_WALLET,
        }}
      />

      <ReferralNetworkDialog
        open={isNetworkOpen}
        onOpenChange={setIsNetworkOpen}
        walletAddress={MOCK_WALLET}
        mockData={mockNetwork}
        mockStatus={mockStatus}
      />

      <ChangeReferrerDialog
        open={isChangeOpen}
        onOpenChange={setIsChangeOpen}
        currentReferrerEns={mockStatus.referrer?.ensName}
        currentReferrerWallet={mockStatus.referrer?.wallet}
        mock={{
          changeReferrer: mockChangeReferrer,
          isChanging,
        }}
      />
    </div>
  );
}
