"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Coins, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimsPanelProps {
  claimable: {
    usdg: string;
    glow: string;
    impactVested: string;
  };
  onClaim: (token: string) => void;
  onClaimAll: () => void;
}

export function ClaimsPanel({
  claimable,
  onClaim,
  onClaimAll,
}: ClaimsPanelProps) {
  const hasClaimable =
    claimable.usdg !== "0" ||
    claimable.glow !== "0" ||
    claimable.impactVested !== "0";

  if (!hasClaimable) {
    return null;
  }

  const claimableItems = [
    {
      token: "USDG",
      amount: claimable.usdg,
      icon: <Coins className="w-4 h-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      token: "GLOW",
      amount: claimable.glow,
      icon: <Sparkles className="w-4 h-4" />,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
    },
  ].filter((item) => item.amount !== "0");

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Claims Available
            </CardTitle>
            <CardDescription className="mt-2">
              Claim your earned tokens and vested impact credits
            </CardDescription>
          </div>
          {claimableItems.length > 1 && (
            <Button onClick={onClaimAll}>
              Claim All
              <Badge variant="secondary" className="ml-2">
                {claimableItems.length} tokens
              </Badge>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Token Claims */}
          {claimableItems.map((item) => (
            <div
              key={item.token}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border",
                item.bgColor
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn("p-2 rounded-full bg-background", item.color)}
                >
                  {item.icon}
                </div>
                <div>
                  <div className="font-medium">{item.token} Rewards</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-lg">{item.amount}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.token}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onClaim(item.token)}
                >
                  Claim
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <div className="font-medium mb-1">About Claims</div>
              <div>Multiple claims may require separate transactions.</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
