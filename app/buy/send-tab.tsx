"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/connect-button";
import { toast } from "sonner";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { SYMBOLS } from "@/hooks/useERC20Balances";
import { Token } from "./view";
import { useERC20 } from "@/hooks/useERC20";
import { formatUnits, isAddress, parseUnits } from "viem";

type BalanceLike = bigint | { toString(): string } | null;

interface SendTabProps {
  isConnected: boolean;
  isWalletLoading: boolean;
  balancesLoading: boolean;
  glowBalance: BalanceLike;
  usdgBalance: BalanceLike;
  signer: any;

  refreshBalances: () => Promise<void>;
  tokens: {
    GLOW: Token;
    USDG: Token;
  };
}

export function SendTab({
  isConnected,
  isWalletLoading,
  balancesLoading,
  glowBalance,
  usdgBalance,
  signer,
  refreshBalances,
  tokens,
}: SendTabProps) {
  const { sendTokens, isReady: isSendTokensReady } = useERC20({ signer });
  const [amountToSend, setAmountToSend] = useState<string>("0");
  const [selectedTokenSend, setSelectedTokenSend] = useState<Token>(
    tokens.GLOW
  );
  const [sendToAddress, setSendToAddress] = useState<string>("");
  const [pendingSendTx, setPendingSendTx] = useState<boolean>(false);

  function toBigIntBalance(value: BalanceLike): bigint {
    if (value === null) return BigInt(0);
    return typeof value === "bigint" ? value : BigInt(value.toString());
  }

  const getTokenToSendBalance = () => {
    const balanceBigInt =
      selectedTokenSend.label === "GLOW"
        ? toBigIntBalance(glowBalance)
        : selectedTokenSend.label === "USDG"
        ? toBigIntBalance(usdgBalance)
        : BigInt(0);

    return Number(formatUnits(balanceBigInt, selectedTokenSend.decimals));
  };

  const getSendButtonProps = () => {
    if (Number(amountToSend) === 0) {
      return {
        label: `Enter an amount`,
        disabled: true,
      };
    } else if (!sendToAddress) {
      return {
        label: `Enter an address`,
        disabled: true,
      };
    } else if (
      Number(amountToSend) > Number(toFixedTruncate(getTokenToSendBalance(), 6))
    ) {
      return {
        label: `Insufficient ${selectedTokenSend.label} balance`,
        disabled: true,
      };
    } else {
      return {
        label: `Send`,
        disabled: false,
      };
    }
  };

  const handleSendToken = async () => {
    if (!isSendTokensReady) {
      toast.error("Send tokens hook not ready");
      return;
    }
    // Verify if amountToSend is positive and valid number
    if (Number.isNaN(Number(amountToSend)) || Number(amountToSend) <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (isAddress(sendToAddress)) {
      setPendingSendTx(true);
      try {
        const amountToSendFormated = parseUnits(
          amountToSend,
          selectedTokenSend.decimals
        );

        const result = await sendTokens(
          selectedTokenSend.label as SYMBOLS,
          sendToAddress as `0x${string}`,
          // Cast to any for transition until hooks are updated to bigint
          amountToSendFormated as any
        );

        if (result.ok) {
          await refreshBalances();
          setPendingSendTx(false);
          toast.success("Transaction successful");
          // Reset form
          setAmountToSend("0");
          setSendToAddress("");
        } else {
          console.log(result.val);
          toast.error(result.val || "Transaction failed");
          setPendingSendTx(false);
        }
      } catch (error) {
        console.log(error);
        toast.error("Transaction failed");
        setPendingSendTx(false);
      }
    } else {
      toast.error("Invalid address");
    }
  };

  const handleSelectTokenToSend = (value: string) => {
    const token = Object.values(tokens).find((t) => t.label === value)!;
    setSelectedTokenSend(token);
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Amount Input */}
      <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs lg:text-sm font-medium text-muted-foreground">
            Amount
          </span>
          {isConnected && (
            <span className="text-xs lg:text-sm text-muted-foreground">
              Balance:{" "}
              <span className="font-medium">
                {isWalletLoading || balancesLoading ? (
                  <Skeleton className="w-16 h-4 inline-block" />
                ) : (
                  toFixedTruncate(getTokenToSendBalance(), 2)
                )}
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <Input
              type="text"
              placeholder="0.00"
              className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
              value={amountToSend}
              disabled={!isConnected || isWalletLoading}
              onChange={(e) => {
                if (Number(e.target.value) < 0) {
                  setAmountToSend("0");
                  return;
                }
                setAmountToSend(e.target.value);
              }}
            />
          </div>
          <Select
            disabled={!isConnected || isWalletLoading}
            value={selectedTokenSend.label}
            onValueChange={handleSelectTokenToSend}
          >
            <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-md border-border bg-background font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOW">GLOW</SelectItem>
              <SelectItem value="USDG">USDG</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enhanced Recipient Input */}
      <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs lg:text-sm font-medium text-muted-foreground">
            Recipient Address
          </span>
        </div>
        <Input
          type="text"
          placeholder="0x..."
          className="w-full bg-transparent border-0 p-0 text-sm lg:text-base font-mono focus-visible:ring-0 placeholder:text-muted-foreground/40 break-all"
          value={sendToAddress}
          disabled={!isConnected || isWalletLoading}
          onChange={(e) => setSendToAddress(e.target.value)}
        />
      </div>

      {/* Enhanced Send Button */}
      <div className="pt-4">
        {!isConnected && !isWalletLoading ? (
          <ConnectButton variant="default" />
        ) : isWalletLoading ? (
          <ConnectButton variant="default" />
        ) : (
          <Button
            disabled={getSendButtonProps().disabled || pendingSendTx}
            onClick={handleSendToken}
            className="w-full h-12 lg:h-16"
          >
            {pendingSendTx && (
              <div className="mr-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {pendingSendTx ? "Sending..." : getSendButtonProps().label}
          </Button>
        )}
      </div>
    </div>
  );
}
