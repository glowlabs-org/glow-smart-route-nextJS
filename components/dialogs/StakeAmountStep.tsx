"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Info,
  Zap,
  Minus,
  Plus,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

interface StakeAmountStepProps {
  stakeAmount: number;
  setStakeAmount: (amount: number) => void;
  maxStakeAmount: number;
  gctlBalance: number;
  currentStaked: number;
  targetAmount: number;

  userContributionPercentage: number;
  projectedProgress: number;
  currentProgress: number;
  showBalanceInfo?: boolean;
  gctlPriceNumber?: number;
  currencySymbol?: string;
  selectedCurrency?: string;
  onCurrencyChange?: (currency: string) => void;
  stableBalance?: number | null;
  isStableBalanceLoading?: boolean;
}

export function StakeAmountStep({
  stakeAmount,
  setStakeAmount,
  maxStakeAmount,
  gctlBalance,
  currentStaked,
  targetAmount,
  userContributionPercentage,
  projectedProgress,
  currentProgress,
  showBalanceInfo = true,
  gctlPriceNumber = 1,
  currencySymbol = "GCTL",
  selectedCurrency = "USDC",
  onCurrencyChange,
  stableBalance = null,
  isStableBalanceLoading = false,
}: StakeAmountStepProps) {
  const { t } = useLang();
  const c = t.bigDialogs.contribute;
  const [inputValue, setInputValue] = useState(stakeAmount.toString());
  const [isEditingInput, setIsEditingInput] = useState(false);

  // Calculate USD values
  const gctlBalanceUSD = useMemo(() => {
    return gctlBalance * gctlPriceNumber;
  }, [gctlBalance, gctlPriceNumber]);

  // Update input when stake amount changes
  useEffect(() => {
    if (!isEditingInput) {
      setInputValue(stakeAmount > 0 ? stakeAmount.toString() : "");
    }
  }, [stakeAmount, isEditingInput]);

  // Normalize stake amount to GCTL for displays that require GCTL
  const stakeAmountInGctl = useMemo(() => {
    if (selectedCurrency === "GCTL") return stakeAmount;
    if (!gctlPriceNumber || gctlPriceNumber <= 0) return 0;
    return stakeAmount / gctlPriceNumber;
  }, [stakeAmount, selectedCurrency, gctlPriceNumber]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsEditingInput(true);

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setStakeAmount(Math.min(numValue, maxStakeAmount));
    } else if (value === "") {
      setStakeAmount(0);
    }
  };

  const handleInputBlur = () => {
    setIsEditingInput(false);
    // Ensure input shows current stake amount
    setInputValue(stakeAmount > 0 ? stakeAmount.toString() : "");
  };

  // Increment/decrement by appropriate amount
  const handleIncrement = (direction: "up" | "down") => {
    // If there is no target (activated region), use 1% of maxStakeAmount for GCTL increments
    const gctlStepBase =
      (targetAmount > 0 ? targetAmount : maxStakeAmount) * 0.01;
    const increment =
      selectedCurrency === "GCTL" ? Math.max(0.1, gctlStepBase) : 10;
    const newAmount =
      direction === "up"
        ? Math.min(stakeAmount + increment, maxStakeAmount)
        : Math.max(stakeAmount - increment, 0);
    setStakeAmount(Math.round(newAmount * 100) / 100);
  };

  // Quick select buttons
  const quickSelectPercentages = [25, 50, 75, 100];

  const handleQuickSelect = (percentage: number) => {
    const amount = (percentage / 100) * maxStakeAmount;
    setStakeAmount(Math.round(amount * 100) / 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Balance Information */}
      {showBalanceInfo && (
        <div className="p-5 bg-muted/30 dark:bg-muted/50 rounded-xl border border-border/20 dark:border-border/40">
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            {/* Your Balance */}
            <div className="flex-1 p-4 md:p-5">
              <div className="flex items-center gap-3 mb-3">
                <Select
                  value={selectedCurrency}
                  onValueChange={onCurrencyChange}
                >
                  <SelectTrigger className="h-10 w-[160px] rounded-full bg-background">
                    <SelectValue placeholder={c.paymentMethod} />
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[160px]">
                    {gctlBalance > 0 && (
                      <SelectItem value="GCTL">{c.gctlBalance}</SelectItem>
                    )}
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDG">USDG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedCurrency === "GCTL" ? (
                <>
                  <p className="text-3xl font-semibold mb-1">
                    {gctlBalance.toLocaleString()}
                    <span className="text-lg font-normal text-muted-foreground ml-2">
                      GCTL
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">
                    {c.approxUsd(
                      gctlBalanceUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                    )}
                  </p>
                  {currentStaked > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {c.alreadyStaked(currentStaked.toLocaleString())}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold mb-1">
                    {isStableBalanceLoading
                      ? c.loading
                      : (stableBalance ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    <span className="text-lg font-normal text-muted-foreground ml-2">
                      {selectedCurrency}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.availableBalance}
                  </p>
                </>
              )}
            </div>

            {/* Campaign Needs - only when a target exists */}
            {targetAmount > 0 ? (
              <div className="flex-1 bg-muted/50 dark:bg-muted/60 rounded-xl p-4 md:p-5 border border-border/20 dark:border-border/40">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {c.campaignNeeds}
                  </p>
                </div>
                <p className="text-3xl font-semibold mb-1">
                  {(targetAmount - currentStaked).toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    GCTL
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.toReachThreshold}
                </p>
              </div>
            ) : (
              <div className="flex-1 bg-muted/50 dark:bg-muted/60 rounded-xl p-4 md:p-5 border border-border/20 dark:border-border/40">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {c.infrastructureProjectBalance}
                  </p>
                </div>
                <p className="text-3xl font-semibold mb-1">
                  {currentStaked.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    GCTL
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.stakedAmountForRegion}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amount Selection */}
      <div className="p-5 border border-border/20 dark:border-border/40 rounded-xl bg-muted/30 dark:bg-muted/50">
        <div>
          <label className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-3 block">
            {selectedCurrency === "GCTL"
              ? c.enterGctlAmount
              : c.enterAmountIn(currencySymbol)}
          </label>

          {/* Amount Input with Controls */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleIncrement("down")}
              disabled={stakeAmount === 0}
              className="h-12 w-12"
            >
              <Minus className="h-4 w-4" />
            </Button>

            <div className="flex-1 relative">
              <Input
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="0"
                className="text-center text-2xl font-semibold h-12 pr-20"
                min={0}
                max={maxStakeAmount}
                step={0.01}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {selectedCurrency === "GCTL" ? "GCTL" : currencySymbol}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleIncrement("up")}
              disabled={stakeAmount >= maxStakeAmount}
              className="h-12 w-12"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex gap-2 mb-4">
            {quickSelectPercentages.map((percentage) => (
              <Button
                key={percentage}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(percentage)}
                className="flex-1"
              >
                {percentage}%
              </Button>
            ))}
          </div>
        </div>

        {/* Real-time Impact Visualization */}
        <AnimatePresence mode="wait">
          {stakeAmount > 0 && targetAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-6"
            >
              <div className="space-y-4">
                {/* Contribution Impact */}
                <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{c.yourImpact}</p>
                    </div>
                    <Badge variant="default">
                      {c.ofGoal(userContributionPercentage.toFixed(1))}
                    </Badge>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-2">
                    <div className="h-8 bg-background rounded-full overflow-hidden relative">
                      {/* Current Progress */}
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/30"
                        style={{ width: `${currentProgress}%` }}
                      />
                      {/* User Contribution */}
                      <motion.div
                        className="absolute inset-y-0 bg-primary"
                        initial={{ width: `${currentProgress}%` }}
                        animate={{ width: `${projectedProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                      {/* Percentage Text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-semibold text-foreground">
                          {currentProgress.toFixed(1)}% →{" "}
                          {projectedProgress.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.currentColon(currentStaked.toLocaleString())}</span>
                      <span>
                        {c.afterColon(
                          (currentStaked + stakeAmountInGctl).toLocaleString(),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
