"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDisplayDecimals } from "@/lib/currency";
import { formatNumber } from "./utils";
import {
  farmsForSale,
  paymentCurrencies,
  PaymentCurrency,
  FarmForSale,
} from "./mock-farms";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm: FarmForSale | null;
  selectedCurrency: PaymentCurrency;
}

const QUOTE_LOCK_MINUTES = 60;

function generateQuoteId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Q-${Date.now()}-${rand}`;
}

export function DepositDialog({
  open,
  onOpenChange,
  farm,
  selectedCurrency,
}: DepositDialogProps) {
  const [quoteId, setQuoteId] = React.useState<string>(generateQuoteId());
  const [lockedAtMs, setLockedAtMs] = React.useState<number>(Date.now());
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  const [currency, setCurrency] =
    React.useState<PaymentCurrency>(selectedCurrency);

  const expiryMs = lockedAtMs + QUOTE_LOCK_MINUTES * 60 * 1000;
  const secondsRemaining = Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  React.useEffect(() => {
    if (!open) return;
    setQuoteId(generateQuoteId());
    setLockedAtMs(Date.now());
  }, [open, farm, currency]);

  // when the externally selected currency changes (user picked a different one on the page), sync
  React.useEffect(() => {
    setCurrency(selectedCurrency);
  }, [selectedCurrency]);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  function refreshQuote() {
    try {
      const newId = generateQuoteId();
      setQuoteId(newId);
      setLockedAtMs(Date.now());
      toast.success("Quote refreshed", { description: `New quote ${newId}` });
    } catch (error: any) {
      toast.error(error?.message || "Failed to refresh quote");
    }
  }

  function confirmPay() {
    if (!farm) return;
    try {
      const amount = farm.pricePerAsset[currency];
      toast.success("Sponsorship submitted (mock)", {
        description: `${farm.name} • ${formatNumber(
          amount,
          getDisplayDecimals(currency)
        )} ${currency} • Quote ${quoteId}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit sponsorship");
    }
  }

  if (!farm) return null;

  const decimals = getDisplayDecimals(currency);
  const selectedPrice = farm.pricePerAsset[currency];
  const selectedWeeklyDepositReward = farm.weeklyDepositRewards[currency];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm Sponsorship</DialogTitle>
          <DialogDescription>
            Quote {quoteId} • Locked for 60 minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Sponsorship currency
            </span>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as PaymentCurrency)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentCurrencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Farm</div>
              <div className="font-medium">{farm.name}</div>
              <div className="text-xs text-muted-foreground">{farm.region}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Expires in</div>
              <div className="font-semibold tabular-nums">
                {minutes.toString().padStart(2, "0")}:
                {seconds.toString().padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Sponsor amount */}
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">
              Sponsor Deposit Amount
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(selectedPrice, decimals)} {currency}
            </div>
          </div>

          {/* Estimated rewards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">
                Weekly GLW Rewards
              </div>
              <div className="font-medium tabular-nums">
                {formatNumber(farm.weeklyGlowRewards, 2)} GLW
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">
                Weekly Deposit Rewards
              </div>
              <div className="font-medium tabular-nums">
                {formatNumber(selectedWeeklyDepositReward, decimals)} {currency}
              </div>
            </div>
          </div>

          {/* Other sponsor options */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Other sponsor options</div>
            <div className="grid grid-cols-2 gap-2">
              {paymentCurrencies.map((c) => (
                <div key={c} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{c}</div>
                  <div className="font-medium tabular-nums">
                    {formatNumber(farm.pricePerAsset[c], getDisplayDecimals(c))}{" "}
                    {c}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Weekly deposit rewards
                  </div>
                  <div className="text-sm tabular-nums">
                    {formatNumber(
                      farm.weeklyDepositRewards[c],
                      getDisplayDecimals(c)
                    )}{" "}
                    {c}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={refreshQuote}>
              Refresh Quote
            </Button>
            <Button className="ml-auto" onClick={confirmPay}>
              Confirm Sponsorship
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
