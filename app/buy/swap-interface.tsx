/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Result } from "ts-results";
import { useSwap } from "@/hooks/useSwap";
import { Input } from "@/components/ui/input";
import {
  useAccount,
  useDisconnect,
  useConnect,
  useWalletClient,
  usePublicClient,
  useBalance,
  useChainId,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ArrowDownUp, Info, Settings } from "lucide-react";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { ConnectButton } from "@/components/connect-button";
import {
  SmartBalancingAmounts,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";
import { formatPrice } from "@/utils/formatPrice";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { GlowToUsdcDialog } from "@/components/glow-to-usdc-dialog";
import { UsdgToUsdcRedemptionDialog } from "@/components/usdg-to-usdc-redemption-dialog";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import Decimal from "decimal.js";
import { forceDisconnect } from "@/utils/forceDisconnect";

import { cn } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";
import { StatsSidebar } from "./stats-sidebar";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import {
  getSmartAccountStatus,
  isSmartAccountBlocked,
} from "@/web3/web3/utils/detectSmartAccount";
import { trackEvent } from "@/lib/telemetry";
import { tokens } from "./constants";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  isInvalidWalletTxResponseError,
} from "@/lib/normalize-tx-hash";

const defaultTokensEstimate = {
  GLOW: "",
  USDG: "",
  USDC: "",
  ETH: "",
};

const GLOW_PRICE_HARD_CAP = 3.9794;

const swapTokens = {
  USDC: tokens.USDC,
  USDG: tokens.USDG,
  GLOW: tokens.GLOW,
  ETH: tokens.ETH,
} as const;

type SwapTokenLabel = keyof typeof swapTokens;
type SwapToken = (typeof swapTokens)[SwapTokenLabel];

function isSwapTokenLabel(value: string): value is SwapTokenLabel {
  return Object.prototype.hasOwnProperty.call(swapTokens, value);
}

function normalizeSlippageTolerance(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (!/^\d*\.?\d*$/.test(trimmed)) return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return trimmed;
}

function slippagePctToBps(value: string, fallbackBps = 100n) {
  try {
    const d = new Decimal(value || "0");
    if (!d.isFinite() || d.lte(0)) return fallbackBps;
    return BigInt(d.mul(100).toFixed(0, Decimal.ROUND_DOWN));
  } catch {
    return fallbackBps;
  }
}

function formatEthMaxFromWei(valueWei: bigint) {
  const raw = formatUnits(valueWei, 18);
  const [i, f = ""] = raw.split(".");
  const trimmed = f.slice(0, 6);
  return trimmed ? `${i}.${trimmed}` : i;
}

export function SwapInterface({
  glowPrice,
  marketCap,
  ethPriceInUSD,
  isDialog = false,
}: {
  glowPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  isDialog?: boolean;
}) {
  const [estimatedOutputAmount, setEstimatedOutputAmount] = useState<
    typeof defaultTokensEstimate
  >(defaultTokensEstimate);
  const [isTransitionStarted, startTransition] = React.useTransition();
  const [estimateQueueAmount, setEstimateQueueAmount] = useState<number>(0);
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isGlowToUsdcDialogOpen, setIsGlowToUsdcDialogOpen] =
    useState<boolean>(false);
  const [
    isUsdgToUsdcRedemptionDialogOpen,
    setIsUsdgToUsdcRedemptionDialogOpen,
  ] = useState<boolean>(false);
  const [amountToSell, setAmountToSell] = React.useState<string>("");
  const [selectedTokenSell, setSelectedTokenSell] = useState<SwapToken>(
    swapTokens.USDC
  );
  const [selectedTokenBuy, setSelectedTokenBuy] = useState<SwapToken>(
    swapTokens.GLOW
  );
  const [slippageTolerance, setSlippageTolerance] = useState("1");
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const [tokenSellBalance, setTokenSellBalance] = useState<string>("0");
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null
  );
  const [estimateErrorMessage, setEstimateErrorMessage] = useState<
    string | null
  >(null);
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const isEthPayEnabled = chainId === 1 || chainId === 11155111;
  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(
        isConnected &&
          address &&
          selectedTokenSell.label === "ETH" &&
          isEthPayEnabled
      ),
    },
  });

  const ethBalanceFormatted = React.useMemo(() => {
    if (!ethBalanceQuery.data?.value) return "0";
    // wagmi formats as 18 decimals for native ETH
    return ethBalanceQuery.data.formatted;
  }, [ethBalanceQuery.data?.formatted, ethBalanceQuery.data?.value]);

  // Add a general loading state check
  const isWalletLoading = isConnecting;

  const handleSwapDirection = React.useCallback(() => {
    const nextSell = selectedTokenBuy;
    const nextBuyCandidate = selectedTokenSell;
    const allowed = nextSell.allowedPairs as unknown as SwapTokenLabel[];
    if (allowed.length === 0) return;

    const nextBuy = allowed.includes(nextBuyCandidate.label as SwapTokenLabel)
      ? nextBuyCandidate
      : swapTokens[allowed[0]];

    setSelectedTokenSell(nextSell);
    setSelectedTokenBuy(nextBuy);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
  }, [selectedTokenBuy, selectedTokenSell]);

  const [smartBalancingAmounts, setSmartBalancingAmounts] = useState<
    SmartBalancingAmounts & {
      estimatedCostInUSDForEarlyLiquidity: string;
      estimatedCostInUSDForUniswap: string;
      estimatedTotalGasInUSD: string;
    }
  >();
  const [usdgWithdrawAmount, setUsdgWithdrawAmount] = useState<string>("0");
  const [estimatedWithdrawGas, setEstimatedWithdrawGas] = useState<string>("");

  const [isUsdcInRedemptionLoading, setIsUsdcInRedemptionLoading] =
    useState(false);
  const [usdcInRedemption, setUsdcInRedemption] = useState<number>(0);

  const [balancesLoading, setBalancesLoading] = useState<boolean>(true);
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    useState(false);

  const { signer } = useEthersSigner();

  // Smart account check function
  const checkSmartAccountBeforeSwap = async (): Promise<boolean> => {
    if (!address || !walletClient) return false;

    try {
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });

      const isSmartAccount = isSmartAccountBlocked(status);

      if (isSmartAccount) {
        setIsSmartAccountWarningOpen(true);
        return true; // Block the swap
      }

      return false; // Allow the swap
    } catch (error) {
      console.error("Smart account check failed:", error);
      return false; // Allow the swap if check fails
    }
  };

  const {
    purchaseGlowEarlyLiquidity,
    findAmountGlowFromUSDGAmount,
    getSmartBalancingAmounts,
    estimateGasForPurchaseGlowEarlyLiquidity,
  } = usePurchaseGlow();
  const { swapUSDCToUSDG, estimateGasForswapUSDCToUSDG } = useSwapUSDCToUSDG();
  const { estimateEthToUsdc, estimateGasForSwapEthToUsdc, swapEthToUsdc } =
    useSwapETHToUSDC();

  const { estimateGasForRedeemUSDG, getUSDCBalanceOfRedemptionContract } =
    useUSDGRedemption();

  const {
    getBalances,
    isReady,
    usdcBalance,
    setUsdcBalanceForSigner,
    usdgBalance,
    setUsdgBalanceForSigner,
    refreshBalances,
    glowBalance,
    hasError: erc20HasError,
    hasSigner,
  } = useER20Balances({
    signer,
  });

  // Network status check
  const hasNetworkIssues = erc20HasError || (!hasSigner && isConnected);

  const { run: debouncedEstimate, cancel: cancelEstimate } = useDebouncedAsync<
    string,
    void
  >(
    async (value, signal) => {
      setEstimateQueueAmount((prev) => prev + 1);
      try {
        await estimateAmount(value, signal);
      } finally {
        setEstimateQueueAmount((prev) => prev - 1);
      }
    },
    { delayMs: 350 }
  );

  const {
    swap,
    estimateOutputAmount,
    estimateGlowToUSDG,
    estimateGasForUniswap,
  } = useSwap({
    tokenA_address:
      selectedTokenSell.label === "ETH"
        ? swapTokens.USDG.address
        : selectedTokenSell.address,
    tokenB_address:
      selectedTokenSell.label === "ETH"
        ? swapTokens.GLOW.address
        : selectedTokenBuy.address,
  });

  const currentTokenEstimatedOutputAmount =
    estimatedOutputAmount[selectedTokenBuy.label];
  const isEstimateLoading =
    estimateQueueAmount !== 0 && amountToSell ? true : false;
  const pricePerGlow =
    !isEstimateLoading &&
    (selectedTokenSell.label === "USDC" ||
      selectedTokenSell.label === "USDG") &&
    selectedTokenBuy.label === "GLOW"
      ? (() => {
          const usdIn = Number(amountToSell);
          const glowOut = Number(currentTokenEstimatedOutputAmount);
          if (!Number.isFinite(usdIn) || !Number.isFinite(glowOut)) return null;
          if (usdIn <= 0 || glowOut <= 0) return null;
          return usdIn / glowOut;
        })()
      : null;
  const exceedsGlowPriceCap =
    pricePerGlow !== null && pricePerGlow > GLOW_PRICE_HARD_CAP;
  const isGlowPriceHardCapped =
    selectedTokenBuy.label === "GLOW" &&
    (Number(glowPrice) >= GLOW_PRICE_HARD_CAP || exceedsGlowPriceCap);
  const glowLiquidityDisabledMessage =
    exceedsGlowPriceCap && pricePerGlow !== null
      ? `$${toFixedTruncate(
          pricePerGlow,
          6
        )} per GLW would require Early Liquidity, which is disabled right now.`
      : null;

  function handleResponseMessage(data: Result<unknown, string>) {
    if (data.ok) {
      toast.success(
        `$${selectedTokenSell.label} swaped successfully for ${toFixedTruncate(
          Number(currentTokenEstimatedOutputAmount),
          6
        )} ${selectedTokenBuy.label}`
      );
      setActionErrorMessage(null);
      trackEvent("buy_swap_result", {
        ok: true,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
    } else {
      setActionErrorMessage(data.val);
      trackEvent("buy_swap_result", {
        ok: false,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
        error_message: data.val,
      });
    }
  }

  function toUnitsDecimal(value: string, decimals: number): bigint {
    try {
      const d = new Decimal(value || "0");
      if (!d.isFinite() || d.lte(0)) return BigInt(0);
      const scaled = d
        .mul(new Decimal(10).pow(decimals))
        .toFixed(0, Decimal.ROUND_DOWN);
      return BigInt(scaled);
    } catch {
      return BigInt(0);
    }
  }

  function computeButtonProps() {
    if (isGlowPriceHardCapped) {
      return {
        label: "Early liquidity disabled",
        disabled: true,
      };
    }
    if (hasNetworkIssues) {
      return {
        label: `Reconnect Wallet`,
        disabled: false,
        callback: () => {
          forceDisconnect(disconnect, connectors);
        },
      };
    }
    if (Number(amountToSell) === 0) {
      return {
        label: `Enter an amount`,
        disabled: true,
      };
    } else if (Number(tokenSellBalance) < Number(amountToSell)) {
      if (selectedTokenSell.label === "ETH") {
        return {
          label: `Insufficient ETH balance`,
          disabled: true,
        };
      }
      if (selectedTokenSell.label === "USDC") {
        if (
          usdgBalance &&
          Number(formatUnits(usdgBalance, 6)) >= Number(amountToSell)
        ) {
          return {
            label: `BUY`,
            disabled: false,
            callback: () => {
              toast("You have sufficient USDG", {
                description: "Would you like to use USDG instead?",
                duration: Infinity,
                action: {
                  label: "Yes",
                  onClick: () => {
                    handleSelectTokenToSell("USDG");
                    setAmountToSell(amountToSell);
                  },
                },
                cancel: {
                  label: "No",
                  onClick: () => {
                    trackEvent("buy_usdc_to_token_dialog_open", {
                      sell_token: selectedTokenSell.label,
                      buy_token: selectedTokenBuy.label,
                    });
                    setIsDialogOpen(true);
                    toast.dismiss();
                  },
                },
                position: "bottom-center",
              });
            },
          };
        }
        // fix ux show a modal or error instead
        return {
          label: `Insufficient Funds`,
          disabled: true,
          callback: () => {},
        };
      } else if (
        selectedTokenSell.label !== "USDG" &&
        selectedTokenBuy.label !== "GLOW"
      ) {
        return {
          label: `Insufficient ${selectedTokenSell.label} balance`,
          disabled: true,
        };
      } else {
        return {
          label: `CONVERT USDC TO USDG`,
          disabled: false,
          callback: () => {
            handleSelectTokenToSell("USDC");
          },
        };
      }
    } else {
      if (selectedTokenSell.label === "USDC") {
        if (
          usdcBalance &&
          usdgBalance &&
          (() => {
            const amt = toUnitsDecimal(amountToSell, 6);
            return usdcBalance < amt && usdgBalance >= amt;
          })()
        ) {
          return {
            label: `SWAP`,
            disabled: false,
            callback: () => {
              toast("Insufficient USDC", {
                description: "Would you like to use USDG instead?",
                duration: Infinity,
                action: {
                  label: "Yes",
                  onClick: () => {
                    handleSelectTokenToSell("USDG");
                    setAmountToSell(amountToSell);
                  },
                },
                cancel: {
                  label: "No",
                  onClick: (e) => {
                    toast.dismiss();
                  },
                },
                position: "bottom-center",
              });
            },
          };
        }
        // For USDC -> USDG, show the dialog
        if (selectedTokenBuy.label === "USDG") {
          return {
            label: `SWAP`,
            disabled: false,
            callback: async () => {
              // Check for smart account before proceeding
              const isSmartAccount = await checkSmartAccountBeforeSwap();
              if (isSmartAccount) {
                trackEvent("buy_swap_blocked_smart_account", {
                  sell_token: selectedTokenSell.label,
                  buy_token: selectedTokenBuy.label,
                });
                return; // Block the swap if smart account is detected
              }
              trackEvent("buy_usdc_to_token_dialog_open", {
                sell_token: selectedTokenSell.label,
                buy_token: selectedTokenBuy.label,
              });
              setIsDialogOpen(true);
            },
          };
        }
        // Otherwise (e.g., USDC -> GLOW), open the combined flow dialog
        return {
          label: `SWAP`,
          disabled: false,
          callback: async () => {
            // Check for smart account before proceeding
            const isSmartAccount = await checkSmartAccountBeforeSwap();
            if (isSmartAccount) {
              trackEvent("buy_swap_blocked_smart_account", {
                sell_token: selectedTokenSell.label,
                buy_token: selectedTokenBuy.label,
              });
              return; // Block the swap if smart account is detected
            }
            trackEvent("buy_usdc_to_token_dialog_open", {
              sell_token: selectedTokenSell.label,
              buy_token: selectedTokenBuy.label,
            });
            setIsDialogOpen(true);
          },
        };
      } else if (
        selectedTokenSell.label === "USDG" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        return {
          label: `SWAP`,
          disabled: false,
          callback: async () => {
            // Check for smart account before proceeding
            const isSmartAccount = await checkSmartAccountBeforeSwap();
            if (isSmartAccount) {
              trackEvent("buy_swap_blocked_smart_account", {
                sell_token: selectedTokenSell.label,
                buy_token: selectedTokenBuy.label,
              });
              return; // Block the swap if smart account is detected
            }
            trackEvent("buy_usdc_to_token_dialog_open", {
              sell_token: selectedTokenSell.label,
              buy_token: selectedTokenBuy.label,
            });
            setIsDialogOpen(true);
          },
        };
      } else if (
        selectedTokenSell.label === "ETH" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        return {
          label: `SWAP`,
          disabled: false,
          callback: async () => {
            // Check for smart account before proceeding
            const isSmartAccount = await checkSmartAccountBeforeSwap();
            if (isSmartAccount) {
              trackEvent("buy_swap_blocked_smart_account", {
                sell_token: selectedTokenSell.label,
                buy_token: selectedTokenBuy.label,
              });
              return;
            }
            trackEvent("buy_usdc_to_token_dialog_open", {
              sell_token: selectedTokenSell.label,
              buy_token: selectedTokenBuy.label,
            });
            setIsDialogOpen(true);
          },
        };
      } else if (
        selectedTokenSell.label === "GLOW" &&
        selectedTokenBuy.label === "USDC"
      ) {
        return {
          label: `SWAP`,
          disabled: false,
          callback: () => {
            handleBuy();
          },
        };
      } else if (
        selectedTokenSell.label === "GLOW" &&
        selectedTokenBuy.label === "USDG"
      ) {
        return {
          label: `SWAP`,
          disabled: false,
          callback: async () => {
            // Check for smart account before proceeding
            const isSmartAccount = await checkSmartAccountBeforeSwap();
            if (isSmartAccount) {
              trackEvent("buy_swap_blocked_smart_account", {
                sell_token: selectedTokenSell.label,
                buy_token: selectedTokenBuy.label,
              });
              return; // Block the swap if smart account is detected
            }
            trackEvent("buy_glow_to_usdc_dialog_open", {
              sell_token: selectedTokenSell.label,
              buy_token: selectedTokenBuy.label,
            });
            setIsGlowToUsdcDialogOpen(true);
          },
        };
      } else {
        return {
          label: `SWAP`,
          disabled: false,
          callback: () => {
            handleBuy();
          },
        };
      }
    }
  }

  const handleBuy = async () => {
    // Check for smart account before proceeding
    const isSmartAccount = await checkSmartAccountBeforeSwap();
    if (isSmartAccount) {
      trackEvent("buy_swap_blocked_smart_account", {
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
      return; // Block the swap if smart account is detected
    }

    const amountIn = toUnitsDecimal(amountToSell, selectedTokenSell.decimals);

    try {
      setActionErrorMessage(null);
      setPendingTx(true);
      if (
        selectedTokenBuy.label === "GLOW" &&
        selectedTokenSell.label === "USDG"
      ) {
        // buy glow with uniswap
        if (smartBalancingAmounts?.amount_in_uni) {
          const swapRes = await swap({
            amount: BigInt(
              (smartBalancingAmounts.amount_in_uni as any).toString()
            ),
            slippagePercentTenThousandDenominator: BigInt(
              Number(slippageTolerance) * 100
            ),
          });
          if (!swapRes.ok) {
            handleResponseMessage(swapRes);
            setPendingTx(false);
            return;
          }
          handleResponseMessage(swapRes);
        }

        // buy glow with bonding curve
        if (
          smartBalancingAmounts &&
          Number(smartBalancingAmounts?.amount_out_glow) > 0
        ) {
          const incrementsToPurchase = Math.floor(
            Number(smartBalancingAmounts.amount_out_glow) * 100
          );

          const purchaseGlowEarlyLiquidityRes =
            await purchaseGlowEarlyLiquidity({
              incrementsToPurchase,
              slippagePointsTenThousandths: BigInt(
                Number(slippageTolerance) * 100
              ),
            });
          if (!purchaseGlowEarlyLiquidityRes.ok) {
            handleResponseMessage(purchaseGlowEarlyLiquidityRes);
            setPendingTx(false);
            return;
          }
          handleResponseMessage(purchaseGlowEarlyLiquidityRes);
        }
      } else if (
        selectedTokenBuy.label === "USDG" &&
        selectedTokenSell.label === "USDC"
      ) {
        const swapUSDCToUSDGRes = await swapUSDCToUSDG(amountIn);
        handleResponseMessage(swapUSDCToUSDGRes);
      } else if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "USDG"
      ) {
        // Open the USDG to USDC redemption dialog instead of executing directly
        trackEvent("buy_usdg_redemption_dialog_open", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        setIsUsdgToUsdcRedemptionDialogOpen(true);
        setPendingTx(false);
        return;
      } else if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // Open the GLOW to USDC dialog instead of executing directly
        trackEvent("buy_glow_to_usdc_dialog_open", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        setIsGlowToUsdcDialogOpen(true);
        setPendingTx(false);
        return;
      } else if (
        selectedTokenSell.label === "ETH" &&
        selectedTokenBuy.label === "USDC"
      ) {
        const slippageBps = slippagePctToBps(slippageTolerance, 100n);
        const swapEthToUsdcRes = await swapEthToUsdc({
          amountInWei: amountIn,
          slippageBps,
        });
        handleResponseMessage(swapEthToUsdcRes);
      } else {
        const swapRes = await swap({ amount: amountIn });
        handleResponseMessage(swapRes);
      }
      await Promise.all([
        setUsdcBalanceForSigner(),
        setUsdgBalanceForSigner(),
        getTokenSellBalance(),
      ]);
      startTransition(router.refresh);

      setPendingTx(false);
    } catch (error: any) {
      setPendingTx(false);

      let errorMessage = "Transaction failed";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.reason) {
        errorMessage = error.reason;
      } else if (error?.shortMessage) {
        errorMessage = error.shortMessage;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      if (
        isInvalidWalletTxResponseError(error) ||
        isInvalidWalletTxResponseError(errorMessage)
      ) {
        errorMessage = INVALID_WALLET_TX_RESPONSE_MESSAGE;
      }

      // Log critical swap errors to Sentry (skip user rejections)
      if (
        typeof window !== "undefined" &&
        !errorMessage.includes("User rejected") &&
        !errorMessage.includes("User denied")
      ) {
        const normalizedError =
          error instanceof Error ? error : new Error(errorMessage);
        Sentry.captureException(normalizedError, {
          tags: {
            swapFlow: "handleBuy",
            sellToken: selectedTokenSell.label,
            buyToken: selectedTokenBuy.label,
          },
          extra: {
            amountToSell,
            estimatedOutput: currentTokenEstimatedOutputAmount,
            slippageTolerance,
            errorMessage,
            errorCode: error?.code,
            errorReason: error?.reason,
          },
        });
      }

      // Handle common error cases
      if (
        errorMessage.includes("revert") ||
        errorMessage.includes("revert data") ||
        errorMessage.includes("missing revert data")
      ) {
        errorMessage =
          "Transaction failed. This could be due to insufficient liquidity, slippage tolerance exceeded, or contract revert. Please try again with a smaller amount or adjust your slippage tolerance.";
      } else if (errorMessage.includes("insufficient")) {
        errorMessage = "Insufficient balance or liquidity";
      } else if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("User denied")
      ) {
        errorMessage = "Transaction was rejected";
      }

      // Prefer inline UI error for swap submit errors (avoid duplicating toast + UI).
      setActionErrorMessage(errorMessage);
      trackEvent("buy_swap_result", {
        ok: false,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
        error_message: errorMessage,
      });
    }
  };

  const getUniswapFees = async (amount_usdg_in_uniswap: number) => {
    if (amount_usdg_in_uniswap > 0) {
      const estimatedCostInUSDForUniswapResAfterAmountWithFees =
        await estimateGasForUniswap({
          amount: parseUnits(
            toFixedTruncate(Number(amount_usdg_in_uniswap), 6),
            6
          ),
          ethPriceInUSD,
        });

      if (estimatedCostInUSDForUniswapResAfterAmountWithFees.ok) {
        return estimatedCostInUSDForUniswapResAfterAmountWithFees.val;
      }
    }
    return "0";
  };

  const getGlowEarlyLiquidityFees = async (
    amount_out_glow_bonding_curve: number
  ) => {
    if (Number(amount_out_glow_bonding_curve) > 0) {
      const incrementsToPurchase = Math.floor(
        Number(amount_out_glow_bonding_curve) * 100
      );
      const res = await estimateGasForPurchaseGlowEarlyLiquidity({
        incrementsToPurchase,
        slippagePointsTenThousandths: BigInt(200),
        ethPriceInUSD,
      });
      if (res.ok) {
        return res.val;
      }
    }
    return "0";
  };

  const estimateAmount = async (amountStr: string, signal: AbortSignal) => {
    // Early return if contracts aren't ready - this prevents "Contracts not available" errors
    if (!signer || !isReady) {
      return;
    }

    try {
      if (selectedTokenSell.label === "ETH") {
        if (!amountStr || amountStr === "0") {
          if (signal.aborted) return;
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }
        if (!isEthPayEnabled) {
          if (signal.aborted) return;
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }

        const slippageBps = slippagePctToBps(slippageTolerance, 100n);
        let ethWei: bigint;
        try {
          ethWei = parseUnits(amountStr, 18);
        } catch {
          if (signal.aborted) return;
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }

        const ethQuoteRes = await estimateEthToUsdc({
          amountInWei: ethWei,
          slippageBps,
        });
        if (!ethQuoteRes.ok) {
          console.error(ethQuoteRes.val);
          if (!signal.aborted) setEstimateErrorMessage(String(ethQuoteRes.val));
          return;
        }

        const usdcOut = formatUnits(ethQuoteRes.val.amountOutUsdc, 6);
        if (selectedTokenBuy.label === "USDC") {
          if (signal.aborted) return;
          setEstimateErrorMessage(null);
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            USDC: usdcOut,
          });
          return;
        }
        if (selectedTokenBuy.label !== "GLOW") {
          if (signal.aborted) return;
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }

        const usdgEquivalent = usdcOut;
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: usdgEquivalent,
          earlyLiquidityCurrentPrice: Number(glowPrice),
          useEarlyLiquidity: false,
        });
        if (!smartBalancingAmountsRes.ok) {
          console.error(smartBalancingAmountsRes.val);
          if (!signal.aborted)
            setEstimateErrorMessage(String(smartBalancingAmountsRes.val));
          return;
        }

        // early liquidity fees
        let estimatedCostInUSDForEarlyLiquidityAmount = "0";
        estimatedCostInUSDForEarlyLiquidityAmount =
          await getGlowEarlyLiquidityFees(
            Number(smartBalancingAmountsRes.val.amount_out_glow)
          );

        // uniswap fees
        let estimatedCostInUSDForUniswap = "0";
        estimatedCostInUSDForUniswap = await getUniswapFees(
          Number(formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6))
        );

        // usdc -> usdg fees
        let estimatedGasForswapUSDCToUSDG = "0";
        const usdcAmountWei = parseUnits(usdgEquivalent, 6);
        const estimatedGasForswapUSDCToUSDGRes =
          await estimateGasForswapUSDCToUSDG(usdcAmountWei, ethPriceInUSD);
        if (estimatedGasForswapUSDCToUSDGRes.ok)
          estimatedGasForswapUSDCToUSDG = estimatedGasForswapUSDCToUSDGRes.val;

        // eth -> usdc fees
        let estimatedGasForSwapEthToUsdcUSD = "0";
        const ethGasRes = await estimateGasForSwapEthToUsdc({
          amountInWei: ethWei,
          slippageBps,
        });
        if (ethGasRes.ok && ethPriceInUSD) {
          const feeEth = Number(formatUnits(ethGasRes.val.estimatedFeeWei, 18));
          estimatedGasForSwapEthToUsdcUSD = toFixedTruncate(
            feeEth * ethPriceInUSD,
            6
          );
        }

        const amountsWithFees = getOptimalUSDGAmountsWithFees({
          amount_glow_out_uniswap: Number(
            smartBalancingAmountsRes.val.amount_out_uni
          ),
          amount_glow_out_bonding_curve: Number(
            smartBalancingAmountsRes.val.amount_out_glow
          ),
          fees: {
            uniswapFees: Number(estimatedCostInUSDForUniswap),
            bondingCurveFees: Number(estimatedCostInUSDForEarlyLiquidityAmount),
          },
          // If we use both they'll be the same so we can use either
          endingPriceIfBoth: Number(
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice
          ),
          amount_usdg_in_uniswap: Number(
            formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
          ),
          amount_usdg_in_bonding_curve: Number(
            formatUnits(
              smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
              6
            )
          ),
          uniswapUSDGReserves: Number(
            smartBalancingAmountsRes.val.uniswapUSDGReserves
          ),
          uniswapGlowReserves: Number(
            smartBalancingAmountsRes.val.uniswapGlowReserves
          ),
          earlyLiquidityCurrentPrice: Number(glowPrice),
          usdgToSpend: Number(usdgEquivalent),
        });

        // uniswap fees (recompute after fee optimization)
        estimatedCostInUSDForUniswap = await getUniswapFees(
          amountsWithFees.amount_usdg_in_uniswap
        );

        // early liquidity fees (recompute after fee optimization)
        estimatedCostInUSDForEarlyLiquidityAmount =
          await getGlowEarlyLiquidityFees(
            amountsWithFees.amount_out_glow_bonding_curve
          );

        const estimatedTotalGasInUSD = toFixedTruncate(
          Number(estimatedCostInUSDForUniswap) +
            Number(estimatedCostInUSDForEarlyLiquidityAmount) +
            Number(estimatedGasForswapUSDCToUSDG) +
            Number(estimatedGasForSwapEthToUsdcUSD),
          6
        );

        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setSmartBalancingAmounts({
          amount_in_glow_bonding_curve: parseUnits(
            toFixedTruncate(amountsWithFees.amount_usdg_in_bonding_curve, 6),
            6
          ),
          amount_out_glow: toFixedTruncate(
            amountsWithFees.amount_out_glow_bonding_curve,
            18
          ),
          amount_in_uni: parseUnits(
            toFixedTruncate(amountsWithFees.amount_usdg_in_uniswap, 6),
            6
          ),
          amount_out_uni: toFixedTruncate(
            amountsWithFees.amount_out_glow_uniswap,
            18
          ),
          uniswapGlowReserves: smartBalancingAmountsRes.val.uniswapGlowReserves,
          uniswapUSDGReserves: smartBalancingAmountsRes.val.uniswapUSDGReserves,
          earlyLiquidityCurrentPrice:
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
          usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
          estimatedCostInUSDForEarlyLiquidity:
            estimatedCostInUSDForEarlyLiquidityAmount,
          estimatedCostInUSDForUniswap: estimatedCostInUSDForUniswap,
          estimatedTotalGasInUSD: estimatedTotalGasInUSD,
        });

        const uniswapOutFresh = Number(amountsWithFees.amount_out_glow_uniswap);
        const bondingOutFresh = Number(
          amountsWithFees.amount_out_glow_bonding_curve
        );
        const finalOutput =
          (Number.isFinite(uniswapOutFresh) ? uniswapOutFresh : 0) +
          (Number.isFinite(bondingOutFresh) ? bondingOutFresh : 0);

        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: finalOutput.toString(),
        });

        return;
      }
      if (selectedTokenBuy.label === "GLOW") {
        if (!amountStr || amountStr === "0") {
          setSmartBalancingAmounts(undefined);
          setEstimateErrorMessage(null);
          return;
        }
        const uniswapEstimate = await estimateOutputAmount({
          amountIn: toUnitsDecimal(amountStr, 6),
        });
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: Number(amountStr),
          earlyLiquidityCurrentPrice: Number(glowPrice),
          useEarlyLiquidity: false,
        });
        if (!smartBalancingAmountsRes.ok) {
          console.error(smartBalancingAmountsRes.val);
          if (!signal.aborted)
            setEstimateErrorMessage(String(smartBalancingAmountsRes.val));
          return;
        }

        // early liquidity fees
        let estimatedCostInUSDForEarlyLiquidityAmount = "0";
        estimatedCostInUSDForEarlyLiquidityAmount =
          await getGlowEarlyLiquidityFees(
            Number(smartBalancingAmountsRes.val.amount_out_glow)
          );

        //uniswap fees
        let estimatedCostInUSDForUniswap = "0";
        estimatedCostInUSDForUniswap = await getUniswapFees(
          Number(formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6))
        );

        let estimatedGasForswapUSDCToUSDG = "0";
        if (selectedTokenSell.label === "USDC") {
          const estimatedGasForswapUSDCToUSDGRes =
            await estimateGasForswapUSDCToUSDG(
              toUnitsDecimal(amountStr, 6),
              ethPriceInUSD
            );
          if (estimatedGasForswapUSDCToUSDGRes.ok) {
            estimatedGasForswapUSDCToUSDG =
              estimatedGasForswapUSDCToUSDGRes.val;
          }
        }

        const amountsWithFees = getOptimalUSDGAmountsWithFees({
          amount_glow_out_uniswap: Number(
            smartBalancingAmountsRes.val.amount_out_uni
          ),
          amount_glow_out_bonding_curve: Number(
            smartBalancingAmountsRes.val.amount_out_glow
          ),
          fees: {
            uniswapFees: Number(estimatedCostInUSDForUniswap),
            bondingCurveFees: Number(estimatedCostInUSDForEarlyLiquidityAmount),
          },
          //If we use both they'll be the same so we can use either
          endingPriceIfBoth: Number(
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice
          ),

          amount_usdg_in_uniswap: Number(
            formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
          ),
          amount_usdg_in_bonding_curve: Number(
            formatUnits(
              smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
              6
            )
          ),
          uniswapUSDGReserves: Number(
            smartBalancingAmountsRes.val.uniswapUSDGReserves
          ),
          uniswapGlowReserves: Number(
            smartBalancingAmountsRes.val.uniswapGlowReserves
          ),
          earlyLiquidityCurrentPrice: Number(glowPrice),
          usdgToSpend: Number(amountStr),
        });

        //uniswap fees
        estimatedCostInUSDForUniswap = await getUniswapFees(
          amountsWithFees.amount_usdg_in_uniswap
        );

        // early liquidity fees
        estimatedCostInUSDForEarlyLiquidityAmount =
          await getGlowEarlyLiquidityFees(
            amountsWithFees.amount_out_glow_bonding_curve
          );

        const estimatedTotalGasInUSD = toFixedTruncate(
          Number(estimatedCostInUSDForUniswap) +
            Number(estimatedCostInUSDForEarlyLiquidityAmount) +
            Number(estimatedGasForswapUSDCToUSDG),
          6
        );

        if (signal.aborted) return; // stale
        setSmartBalancingAmounts({
          amount_in_glow_bonding_curve: parseUnits(
            toFixedTruncate(amountsWithFees.amount_usdg_in_bonding_curve, 6),
            6
          ),
          amount_out_glow: toFixedTruncate(
            amountsWithFees.amount_out_glow_bonding_curve,
            18
          ),
          amount_in_uni: parseUnits(
            toFixedTruncate(amountsWithFees.amount_usdg_in_uniswap, 6),
            6
          ),
          amount_out_uni: toFixedTruncate(
            amountsWithFees.amount_out_glow_uniswap,
            18
          ),
          uniswapGlowReserves: smartBalancingAmountsRes.val.uniswapGlowReserves,
          uniswapUSDGReserves: smartBalancingAmountsRes.val.uniswapUSDGReserves,
          earlyLiquidityCurrentPrice:
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
          usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
          estimatedCostInUSDForEarlyLiquidity:
            estimatedCostInUSDForEarlyLiquidityAmount,
          estimatedCostInUSDForUniswap: estimatedCostInUSDForUniswap,
          estimatedTotalGasInUSD: estimatedTotalGasInUSD,
        });

        const findAmountGlowFromUSDGAmountRes =
          await findAmountGlowFromUSDGAmount(toUnitsDecimal(amountStr, 6));

        if (!uniswapEstimate.ok) {
          // Don't show "Contracts not available" error - it's expected when wallet not connected
          if (String(uniswapEstimate.val).includes("Contracts not available")) {
            return;
          }
          console.error("!uniswapEstimate.ok", uniswapEstimate.val);
          if (!signal.aborted)
            setEstimateErrorMessage(String(uniswapEstimate.val));
          return;
        }

        if (!findAmountGlowFromUSDGAmountRes.ok) {
          console.error(
            "!findAmountGlowFromUSDGAmountRes.ok)",
            findAmountGlowFromUSDGAmountRes.val
          );
          if (!signal.aborted)
            setEstimateErrorMessage(
              String(findAmountGlowFromUSDGAmountRes.val)
            );
          return;
        }

        const estimatedUniswapOutputAmount = Number(
          formatUnits(uniswapEstimate.val, 18)
        );
        const estimatedOutputAmountFormated = Number(
          formatUnits(findAmountGlowFromUSDGAmountRes.val, 18)
        );

        // Use fresh calculation results to avoid stale state
        let finalOutput: number;
        const uniswapOutFresh = Number(amountsWithFees.amount_out_glow_uniswap);
        const bondingOutFresh = Number(
          amountsWithFees.amount_out_glow_bonding_curve
        );
        const hasFresh =
          Number.isFinite(uniswapOutFresh) || Number.isFinite(bondingOutFresh);
        if (hasFresh) {
          finalOutput =
            (Number.isFinite(uniswapOutFresh) ? uniswapOutFresh : 0) +
            (Number.isFinite(bondingOutFresh) ? bondingOutFresh : 0);
        } else {
          // Fallback to max output for non-smart balancing scenarios
          finalOutput = Math.max(
            estimatedUniswapOutputAmount,
            estimatedOutputAmountFormated
          );
        }

        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: finalOutput.toString(),
        });

        return;
      }
      if (
        selectedTokenBuy.label === "USDG" &&
        selectedTokenSell.label === "USDC"
      ) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountStr,
        });
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "USDG"
      ) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountStr,
        });
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // For GLOW -> USDC, we need to estimate GLOW -> USDG first
        const estimateRes = await estimateGlowToUSDG({
          amountIn: toUnitsDecimal(amountStr, selectedTokenSell.decimals),
        });

        if (estimateRes.ok) {
          // USDG to USDC is 1:1, so the USDG amount equals USDC amount
          if (signal.aborted) return; // stale
          setEstimateErrorMessage(null);
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            [selectedTokenBuy.label]: formatUnits(estimateRes.val, 6),
          });
        }
        return;
      }
      const estimateRes = await estimateOutputAmount({
        amountIn: toUnitsDecimal(amountStr, selectedTokenSell.decimals),
      });

      if (estimateRes.ok) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: formatUnits(
            estimateRes.val,
            selectedTokenBuy.decimals
          ),
        });
      }
    } catch (error: any) {
      // Log estimate errors to Sentry
      if (typeof window !== "undefined") {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(error?.message || "Failed to estimate swap amount");
        Sentry.captureException(normalizedError, {
          tags: {
            estimateFlow: "estimateAmount",
            sellToken: selectedTokenSell.label,
            buyToken: selectedTokenBuy.label,
          },
          extra: {
            amountStr,
            errorMessage: error?.message,
            errorCode: error?.code,
          },
        });
      }

      if (!signal.aborted)
        setEstimateErrorMessage(
          error?.message || "Failed to estimate swap amount"
        );
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
    }
  };

  const getTokenSellBalance = async () => {
    try {
      if (selectedTokenSell.label === "ETH") {
        setBalancesLoading(false);
        setTokenSellBalance(ethBalanceFormatted);
        return;
      }
      setBalancesLoading(true);
      const balances = await getBalances();
      await refreshBalances();
      if (balances.ok) {
        const raw =
          selectedTokenSell.label === "USDC"
            ? balances.val.usdc
            : selectedTokenSell.label === "USDG"
            ? balances.val.usdg
            : balances.val.glow;
        setTokenSellBalance(formatUnits(raw, selectedTokenSell.decimals));
      }
      setBalancesLoading(false);
    } catch (error) {
      console.error("Error in getTokenSellBalance:", error);
      setBalancesLoading(false);
    }
  };

  const handleSelectTokenToSell = (value: string) => {
    if (!isSwapTokenLabel(value)) return;
    const token = swapTokens[value];
    const nextBuyLabel = token.allowedPairs[0] as SwapTokenLabel | undefined;
    if (nextBuyLabel) setSelectedTokenBuy(swapTokens[nextBuyLabel]);

    setSelectedTokenSell(token);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
  };

  const handleSelectTokenToBuy = (value: string) => {
    if (!isSwapTokenLabel(value)) return;
    setSelectedTokenBuy(swapTokens[value]);

    setSmartBalancingAmounts(undefined);

    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
  };

  const buttonProps = computeButtonProps();

  // Fetch only the sell token balance when sell token or wallet readiness changes
  useEffect(() => {
    if (!selectedTokenSell) return;
    if (selectedTokenSell.label === "ETH") {
      setTokenSellBalance(ethBalanceFormatted);
      setBalancesLoading(false);
      return;
    }
    if (signer && isReady) getTokenSellBalance();
  }, [selectedTokenSell, signer, isReady, ethBalanceFormatted]);

  // Estimate output when inputs change; no balance fetch here
  useEffect(() => {
    // Only estimate if contracts are ready (signer available)
    if (!signer || !isReady) {
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
      return;
    }

    if (selectedTokenSell && selectedTokenBuy && amountToSell) {
      if (!Number.isNaN(Number(amountToSell)) && Number(amountToSell) > 0) {
        debouncedEstimate(amountToSell);
      } else {
        setSmartBalancingAmounts(undefined);
        setEstimatedOutputAmount(defaultTokensEstimate);
      }
    } else {
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
    }
    return () => {
      cancelEstimate();
    };
  }, [selectedTokenSell, selectedTokenBuy, amountToSell, signer, isReady]);

  // Add effect to fetch USDC balance when wallet connects
  useEffect(() => {
    const fetchUsdcInRedemption = async () => {
      if (isConnected && !isWalletLoading) {
        setIsUsdcInRedemptionLoading(true);
        const balance = await getUSDCBalanceOfRedemptionContract();
        if (balance) {
          setUsdcInRedemption(Number(formatUnits(balance, 6)));
        }
        setIsUsdcInRedemptionLoading(false);
      }
    };
    fetchUsdcInRedemption();
  }, [isConnected, isWalletLoading]);

  useEffect(() => {
    async function estimate() {
      if (!usdgWithdrawAmount || Number(usdgWithdrawAmount) <= 0) {
        setEstimatedWithdrawGas("");
        return;
      }
      try {
        const res = await estimateGasForRedeemUSDG(
          parseUnits(usdgWithdrawAmount, 6),
          ethPriceInUSD
        );
        if (res.ok) setEstimatedWithdrawGas(res.val);
        else setEstimatedWithdrawGas("");
      } catch {
        setEstimatedWithdrawGas("");
      }
    }
    estimate();
  }, [usdgWithdrawAmount, ethPriceInUSD, estimateGasForRedeemUSDG]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        !isDialog && "lg:grid-cols-[1fr_320px] mt-2 lg:mt-4"
      )}
    >
      {/* Main Swap Content */}
      <div
        className={cn(
          "bg-card rounded-3xl border border-border/20 overflow-hidden w-full h-fit mx-auto",
          isDialog ? "p-0 border-0" : "p-4 lg:p-6 max-w-[600px] lg:max-w-none"
        )}
      >
        <div className="space-y-1">
          {/* Enhanced From Token */}
          <div className="group relative bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 lg:p-6 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                You pay
              </span>
              {isConnected && (
                <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                  <span>
                    Balance:{" "}
                    <span className="font-medium">
                      {isWalletLoading || balancesLoading ? (
                        <Skeleton className="w-16 h-4 inline-block" />
                      ) : (
                        Number(tokenSellBalance).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      )}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      className="h-7 px-2 py-0 text-xs"
                      disabled={
                        !isConnected || isWalletLoading || balancesLoading
                      }
                      onClick={async () => {
                        if (selectedTokenSell.label === "ETH") {
                          const ethBalanceWei = ethBalanceQuery.data?.value;
                          if (!ethBalanceWei) return;

                          try {
                            const probeWei =
                              ethBalanceWei > parseUnits("0.05", 18)
                                ? parseUnits("0.05", 18)
                                : ethBalanceWei;
                            const gasRes = await estimateGasForSwapEthToUsdc({
                              amountInWei: probeWei,
                              slippageBps: slippagePctToBps(
                                slippageTolerance,
                                100n
                              ),
                            });
                            const feeWei = gasRes.ok
                              ? gasRes.val.estimatedFeeWei
                              : 0n;
                            const bufferedFeeWei = (feeWei * 12n) / 10n; // +20%
                            const maxSpendWei =
                              ethBalanceWei > bufferedFeeWei
                                ? ethBalanceWei - bufferedFeeWei
                                : 0n;
                            setAmountToSell(formatEthMaxFromWei(maxSpendWei));
                          } catch (e: any) {
                            toast.error(
                              e?.message || "Failed to compute max ETH amount"
                            );
                          }
                          return;
                        }

                        const maxVal = toFixedTruncate(
                          Number(tokenSellBalance || 0),
                          selectedTokenSell.toFixed
                        );
                        setAmountToSell(maxVal);
                      }}
                    >
                      Max
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-7 w-7 p-0"
                          aria-label="Slippage tolerance"
                          disabled={!isConnected || isWalletLoading}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[220px]"
                      >
                        <DropdownMenuLabel>
                          Slippage tolerance
                        </DropdownMenuLabel>
                        <div className="px-3 pb-2 text-[11px] text-muted-foreground">
                          Current:{" "}
                          <span className="font-mono text-foreground">
                            {slippageTolerance}%
                          </span>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={slippageTolerance}
                          onValueChange={(value) => {
                            setSlippageTolerance(
                              normalizeSlippageTolerance(value, "1")
                            );
                          }}
                        >
                          {["0.5", "1", "2", "5", "10"].map((value) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                              {value}%
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <div className="px-3 py-2">
                          <div className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Custom
                          </div>
                          <Input
                            inputMode="decimal"
                            placeholder="e.g. 1"
                            value={slippageTolerance}
                            onChange={(e) => {
                              // Accept comma as decimal separator (common in EU locales)
                              const next = e.target.value.replace(",", ".");
                              if (!/^\d*\.?\d*$/.test(next)) return;
                              setSlippageTolerance(next);
                            }}
                            onBlur={() => {
                              setSlippageTolerance((prev) =>
                                normalizeSlippageTolerance(prev, "1")
                              );
                            }}
                            className="h-9"
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                  value={amountToSell}
                  disabled={!isConnected || isWalletLoading}
                  onChange={(e) => {
                    // Accept comma as decimal separator (common in EU locales)
                    const value = e.target.value.replace(",", ".");
                    if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
                      return;
                    }
                    if (Number(value) < 0) {
                      setAmountToSell("");
                      return;
                    }
                    setAmountToSell(value);
                  }}
                />
              </div>
              <Select
                disabled={!isConnected || isWalletLoading}
                value={selectedTokenSell.label}
                onValueChange={handleSelectTokenToSell}
              >
                <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-xl border-border bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="GLOW">GLOW</SelectItem>
                  <SelectItem value="USDG">USDG</SelectItem>
                  {isEthPayEnabled && <SelectItem value="ETH">ETH</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Swap Direction */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                disabled={!isConnected || isWalletLoading}
                onClick={handleSwapDirection}
                className="bg-card border-2 border-border/30 rounded-full p-2 lg:p-3 hover:bg-muted/30 transition-colors z-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ArrowDownUp className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Enhanced To Token */}
          <div className="group relative bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 lg:p-6 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                You receive
              </span>
              {isEstimateLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Calculating...
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                {isEstimateLoading ? (
                  <Skeleton className="h-10 lg:h-14 w-full bg-muted/50" />
                ) : (
                  <Input
                    placeholder="0.00"
                    className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                    value={
                      Number(currentTokenEstimatedOutputAmount)
                        ? formatPrice(
                            currentTokenEstimatedOutputAmount,
                            selectedTokenBuy.toFixed
                          )
                        : ""
                    }
                    disabled={!isConnected || isWalletLoading}
                    readOnly
                  />
                )}
                {pricePerGlow !== null && !isEstimateLoading && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {glowLiquidityDisabledMessage ??
                      `$${toFixedTruncate(pricePerGlow, 6)} per GLW`}
                  </div>
                )}
              </div>
              <Select
                disabled={!isConnected || isWalletLoading}
                value={selectedTokenBuy.label}
                onValueChange={handleSelectTokenToBuy}
              >
                <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-xl border-border bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedTokenSell.allowedPairs.map((token) => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Transaction Details */}
          {smartBalancingAmounts && selectedTokenBuy.label === "GLOW" && (
            <div className="mt-4 bg-gradient-to-r from-muted/10 to-muted/5 dark:from-muted/20 dark:to-muted/10 rounded-xl p-4 lg:p-5 space-y-4 border border-border/20 dark:border-border/40">
              {/* Only show route details if using both Uniswap and Bonding Curve */}
              {Number(smartBalancingAmounts?.amount_out_glow) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Uniswap Route
                    </div>
                    <div className="text-sm font-medium">
                      {isEstimateLoading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        `${Number(
                          smartBalancingAmounts?.amount_out_uni
                        ).toFixed(6)} GLOW`
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Bonding Curve
                    </div>
                    <div className="text-sm font-medium">
                      {isEstimateLoading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        `${Number(
                          smartBalancingAmounts?.amount_out_glow
                        ).toFixed(6)} GLOW`
                      )}
                    </div>
                  </div>
                </div>
              )}

              {estimateErrorMessage && (
                <div className="text-xs text-destructive pt-2">
                  {estimateErrorMessage}
                </div>
              )}
              <div className="pt-3 border-t border-border/20 dark:border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-muted-foreground">
                    Estimated Network Fee
                  </span>
                  <span className="text-xs lg:text-sm font-medium">
                    {isEstimateLoading ? (
                      <Skeleton className="w-16 h-4" />
                    ) : (
                      `~$${Number(
                        smartBalancingAmounts.estimatedTotalGasInUSD
                      ).toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Swap Button */}
          <div className="pt-5">
            {!isConnected || isConnecting ? (
              <ConnectButton variant="default" />
            ) : (
              <Button
                disabled={
                  hasNetworkIssues
                    ? false // Never disable the Reconnect Wallet button
                    : buttonProps.disabled ||
                      pendingTx ||
                      isEstimateLoading ||
                      balancesLoading
                }
                onClick={async () => {
                  const isSwapAction =
                    buttonProps.label === "SWAP" ||
                    buttonProps.label === "BUY" ||
                    buttonProps.label === "CONVERT USDC TO USDG";
                  if (isSwapAction) {
                    trackEvent("buy_swap_click", {
                      sell_token: selectedTokenSell.label,
                      buy_token: selectedTokenBuy.label,
                      amount_in: amountToSell,
                      slippage_pct: slippageTolerance,
                      has_network_issues: hasNetworkIssues,
                    });
                  }
                  await Promise.resolve(buttonProps.callback?.());
                }}
                className="w-full h-12 lg:h-16"
              >
                {pendingTx && (
                  <div className="mr-3">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                {pendingTx ? "Processing..." : buttonProps.label}
              </Button>
            )}

            {actionErrorMessage && (
              <div className="text-sm text-destructive mt-3">
                {actionErrorMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Hidden on mobile, visible on lg and up */}
      {!isDialog && (
        <aside className="lg:sticky lg:top-4 h-fit space-y-4">
          <StatsSidebar
            marketCap={marketCap}
            usdcInRedemption={usdcInRedemption}
            statsLoading={false}
            isUsdcInRedemptionLoading={isUsdcInRedemptionLoading}
            isWalletLoading={isWalletLoading}
          />
        </aside>
      )}

      {/* Dialogs */}
      <UsdcToTokenDialog
        isOpen={isDialogOpen}
        amount={currentTokenEstimatedOutputAmount}
        amountToSell={amountToSell}
        selectedTokenSell={selectedTokenSell}
        selectedTokenBuy={selectedTokenBuy}
        smartBalancingAmounts={smartBalancingAmounts}
        swapUSDCToUSDG={swapUSDCToUSDG}
        onOpenChange={async (open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              try {
                await Promise.all([
                  setUsdcBalanceForSigner(),
                  setUsdgBalanceForSigner(),
                  getTokenSellBalance(),
                  refreshBalances(),
                ]);
              } catch {}
            }

            // Refresh the page data
            startTransition(() => router.refresh());
          }
        }}
        slippagePointsTenThousandths={BigInt(Number(slippageTolerance) * 100)}
      />
      <GlowToUsdcDialog
        isOpen={isGlowToUsdcDialogOpen}
        amountToSell={amountToSell}
        estimatedOutputAmount={currentTokenEstimatedOutputAmount}
        slippageTolerance={slippageTolerance}
        targetToken={selectedTokenBuy.label as "USDC" | "USDG"}
        onOpenChange={async (open) => {
          setIsGlowToUsdcDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              try {
                await Promise.all([
                  setUsdcBalanceForSigner(),
                  setUsdgBalanceForSigner(),
                  getTokenSellBalance(),
                  refreshBalances(),
                ]);
              } catch {}
            }

            // Refresh the page data
            startTransition(() => router.refresh());
          }
        }}
      />
      <UsdgToUsdcRedemptionDialog
        isOpen={isUsdgToUsdcRedemptionDialogOpen}
        amountToRedeem={amountToSell}
        onOpenChange={async (open) => {
          setIsUsdgToUsdcRedemptionDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              try {
                await Promise.all([
                  setUsdcBalanceForSigner(),
                  setUsdgBalanceForSigner(),
                  getTokenSellBalance(),
                  refreshBalances(),
                ]);
              } catch {}
            }

            // Refresh the page data
            startTransition(() => router.refresh());
          }
        }}
      />

      {/* Smart Account Warning Dialog */}
      <SmartAccountWarningDialog
        open={isSmartAccountWarningOpen}
        onOpenChange={setIsSmartAccountWarningOpen}
        triggerCheck={false}
      />
    </div>
  );
}
