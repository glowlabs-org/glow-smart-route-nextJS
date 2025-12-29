/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useChainId,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { getAddresses, useForwarder } from "@glowlabs-org/utils/browser";
import { CHAIN_ID } from "@/web3/constants";
import { ProcessingModal } from "@/components/buy-gctl/processing-modal";
import { ArrowDownUp, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { ConnectButton } from "@/components/connect-button";
import {
  SmartBalancingAmounts,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";
import { formatPrice } from "@/utils/formatPrice";
import { InstructionsDialog } from "@/components/instructions-dialog";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { GlowToUsdcDialog } from "@/components/glow-to-usdc-dialog";
import { UsdgToUsdcRedemptionDialog } from "@/components/usdg-to-usdc-redemption-dialog";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SendTab } from "./send-tab";
import { useQueryState } from "nuqs";
import Decimal from "decimal.js";
import { forceDisconnect } from "@/utils/forceDisconnect";

import { addresses, SDKAddresses } from "@/web3/constants/addresses";
import { MaxUint256 } from "ethers";
import { cn } from "@/lib/utils";
import Image from "next/image";
import PositionsView from "../liquidity/view";
import { useGctlApi } from "@/hooks";
import * as Sentry from "@sentry/nextjs";
import { WalletDashboardTab } from "@/components/wallet/wallet-dashboard-tab";
import { RestakeAssistant } from "@/app/wallet/restake-assistant";
import { UnstakeDialog } from "@/app/wallet/unstake-dialog";
import { ContributeDialog } from "@/components/dialogs/ContributeDialog";
import { StatsSidebar } from "./stats-sidebar";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { trackEvent } from "@/lib/telemetry";

export const tokens = {
  USDG: {
    label: "USDG",
    address: SDKAddresses.USDG,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC", "GCTL"],
    toFixed: 6,
  },
  GLOW: {
    label: "GLOW",
    address: SDKAddresses.GLW,
    decimals: 18,
    allowedPairs: ["USDG", "USDC"],
    toFixed: 6,
  },
  USDC: {
    label: "USDC",
    address: SDKAddresses.USDC as `0x${string}`,
    decimals: 6,
    allowedPairs: ["GLOW", "USDG", "GCTL"],
    toFixed: 6,
  },
  GCTL: {
    label: "GCTL",
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    decimals: 6,
    allowedPairs: [], // GCTL cannot be selected as sell token
    toFixed: 6,
  },
} as const;

const defaultTokensEstimate = {
  GLOW: "",
  USDG: "",
  USDC: "",
  GCTL: "",
};

type TOKENS_ENUM = keyof typeof tokens;
export type Token = (typeof tokens)[keyof typeof tokens];

export default function View({
  glowPrice,
  earlyLiquidityCurrentPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
}: // totalProtocolFeesLast30days,
{
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
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
  const [selectedTokenSell, setSelectedTokenSell] = useState<Token>(
    tokens.USDC
  );
  const [selectedTokenBuy, setSelectedTokenBuy] = useState<Token>(tokens.GLOW);
  const [slippageTolerance, setSlippageTolerance] = useState("1");
  const [isSlippageExpanded, setIsSlippageExpanded] = useState<boolean>(false);
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const [tokenSellBalance, setTokenSellBalance] = useState<string>("0");
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Add a general loading state check
  const isWalletLoading = isConnecting;

  const [smartBalancingAmounts, setSmartBalancingAmounts] = useState<
    SmartBalancingAmounts & {
      estimatedCostInUSDForEarlyLiquidity: string;
      estimatedCostInUSDForUniswap: string;
      estimatedTotalGasInUSD: string;
    }
  >();
  const [usdgWithdrawAmount, setUsdgWithdrawAmount] = useState<string>("0");
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [estimatedWithdrawGas, setEstimatedWithdrawGas] = useState<string>("");

  const [isUsdcInRedemptionLoading, setIsUsdcInRedemptionLoading] =
    useState(false);
  const [usdcInRedemption, setUsdcInRedemption] = useState<number>(0);

  const [balancesLoading, setBalancesLoading] = useState<boolean>(true);
  // GCTL swap & modal state
  const [isProcessingTransaction, setIsProcessingTransaction] =
    useState<boolean>(false);
  const [trackingTxHash, setTrackingTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [processedGctlAmount, setProcessedGctlAmount] = useState<string>("0");

  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    useState(false);

  // Pre-transaction modal for GCTL (approval + submit)
  const [isGctlPreTxDialogOpen, setIsGctlPreTxDialogOpen] =
    useState<boolean>(false);
  const [isGctlPreTxSubmitting, setIsGctlPreTxSubmitting] =
    useState<boolean>(false);
  const [gctlPreTxError, setGctlPreTxError] = useState<string | null>(null);

  // Test USDC minting state (Sepolia only)
  const [isMintingTestUSDC, setIsMintingTestUSDC] = useState(false);
  const isOnSepolia = chainId === 11155111;

  // -------------------------------------------------------------------
  // URL PARAM STATE (txId)
  // -------------------------------------------------------------------
  const [txIdParam, setTxIdParam] = useQueryState("txId", {
    defaultValue: "",
    clearOnDefault: true,
  });

  // Tab state synced with URL (?tab=swap|send|liquidity)
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "swap",
    clearOnDefault: true,
  });

  // Restore processing modal from query param on initial load / refresh
  useEffect(() => {
    if (txIdParam && !isProcessingTransaction) {
      setTrackingTxHash(txIdParam);
      setIsProcessingTransaction(true);
    }
  }, [txIdParam]);

  const { signer } = useEthersSigner();
  // Forwarder & GCTL helpers
  const chainIdNum = parseInt(CHAIN_ID.toString());
  const { mintGCTL, checkTokenAllowance, approveToken, mintTestUSDC } =
    useForwarder(signer as any, chainIdNum);

  // Smart account check function
  const checkSmartAccountBeforeSwap = async (): Promise<boolean> => {
    if (!address || !walletClient) return false;

    try {
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });

      const isSmartAccount =
        status &&
        (status.isContractWallet ||
          status.isEip7702Delegated ||
          status.hasWalletAABatching);

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

  const { gctlPrice, gctlPriceNumber, isGctlPriceLoading } =
    useGctlApi(address);

  // Mint test USDC function (Sepolia only)
  const handleMintTestUSDC = async () => {
    if (!address || !isOnSepolia) return;

    try {
      setIsMintingTestUSDC(true);
      const amount = parseUnits("100000", 6); // Mint 1000 test USDC
      const txHash = await mintTestUSDC(amount, address);

      toast.success(
        `Successfully minted 100000 test USDC! Transaction: ${txHash.slice(
          0,
          10
        )}...`
      );

      // Refresh balances after minting
      await Promise.all([
        setUsdcBalanceForSigner(),
        getTokenSellBalance(),
        refreshBalances(),
      ]);
    } catch (error: any) {
      console.error("Failed to mint test USDC:", error);
      toast.error(error?.message || "Failed to mint test USDC");
    } finally {
      setIsMintingTestUSDC(false);
    }
  };

  const {
    purchaseGlowEarlyLiquidity,
    findAmountGlowFromUSDGAmount,
    getSmartBalancingAmounts,
    estimateGasForPurchaseGlowEarlyLiquidity,
  } = usePurchaseGlow();
  const { swapUSDCToUSDG, estimateGasForswapUSDCToUSDG } = useSwapUSDCToUSDG();

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
    tokenA_address: selectedTokenSell.address,
    tokenB_address: selectedTokenBuy.address,
  });

  const currentTokenEstimatedOutputAmount =
    estimatedOutputAmount[selectedTokenBuy.label];

  function handleResponseMessage(data: Result<boolean, string>) {
    if (data.ok) {
      toast.success(
        `$${selectedTokenSell.label} swaped successfully for ${toFixedTruncate(
          Number(currentTokenEstimatedOutputAmount),
          6
        )} ${selectedTokenBuy.label}`
      );
      trackEvent("buy_swap_result", {
        ok: true,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
    } else {
      toast.error(data.val);
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
        // For USDC -> GCTL, also handle directly
        if (selectedTokenBuy.label === "GCTL") {
          return {
            label: `SWAP`,
            disabled: false,
            callback: () => {
              handleBuy();
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
        selectedTokenBuy.label === "GCTL" &&
        (selectedTokenSell.label === "USDC" ||
          selectedTokenSell.label === "USDG")
      ) {
        try {
          // Open pre-transaction dialog while approving and submitting
          setIsGctlPreTxDialogOpen(true);
          setIsGctlPreTxSubmitting(true);
          setGctlPreTxError(null);

          const amountToSpend = BigInt(
            parseUnits(amountToSell, selectedTokenSell.decimals).toString()
          );

          // 1. Ensure the forwarder is allowed to spend the required USDC/USDG
          try {
            const currentAllowance = await checkTokenAllowance(
              address as `0x${string}`,
              selectedTokenSell.label === "USDC" ? "USDC" : "USDG"
            );

            if (currentAllowance < amountToSpend) {
              await approveToken(
                amountToSpend,
                selectedTokenSell.label === "USDC" ? "USDC" : "USDG"
              );
            }
          } catch (approveError) {
            console.error("Approval failed:", approveError);
            toast.error(
              approveError instanceof Error
                ? approveError.message
                : "Failed to approve token spending"
            );
            setIsGctlPreTxSubmitting(false);
            setGctlPreTxError(
              approveError instanceof Error
                ? approveError.message
                : "Failed to approve token spending"
            );
            setIsProcessingTransaction(false);
            setPendingTx(false);
            return;
          }

          // 2. Mint GCTL
          const txHash = await mintGCTL(
            amountToSpend,
            address as `0x${string}`,
            selectedTokenSell.label === "USDC" ? "USDC" : "USDG"
          );
          trackEvent("buy_gctl_mint_submitted", {
            tx_hash: txHash,
            pay_token: selectedTokenSell.label,
            pay_amount: amountToSell,
          });

          // Close pre-transaction dialog once tx is sent
          setIsGctlPreTxSubmitting(false);
          setIsGctlPreTxDialogOpen(false);

          setTrackingTxHash(txHash);
          setTxIdParam(txHash); // persist txId to URL
          setProcessedGctlAmount(estimatedOutputAmount[selectedTokenBuy.label]);

          // Ensure any other transaction dialogs are closed while processing GCTL
          setIsDialogOpen(false);
          setIsGlowToUsdcDialogOpen(false);
          setIsUsdgToUsdcRedemptionDialogOpen(false);

          // Start processing modal
          setIsProcessingTransaction(true);

          await Promise.all([
            setUsdcBalanceForSigner(),
            setUsdgBalanceForSigner(),
            getTokenSellBalance(),
          ]);

          startTransition(router.refresh);

          setPendingTx(false);
          return;
        } catch (error: any) {
          console.error("Failed to mint GCTL:", error);
          toast.error(error?.message || "Failed to purchase GCTL");
          setIsGctlPreTxSubmitting(false);
          setGctlPreTxError(error?.message || "Failed to purchase GCTL");
          setIsProcessingTransaction(false);
          setPendingTx(false);
          return;
        }
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

      toast.error(errorMessage);
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
    try {
      if (selectedTokenBuy.label === "GLOW") {
        if (!amountStr || amountStr === "0") {
          setSmartBalancingAmounts(undefined);
          return;
        }
        const uniswapEstimate = await estimateOutputAmount({
          amountIn: toUnitsDecimal(amountStr, 6),
        });
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: Number(amountStr),
          earlyLiquidityCurrentPrice: Number(earlyLiquidityCurrentPrice),
        });
        if (!smartBalancingAmountsRes.ok) {
          console.error(smartBalancingAmountsRes.val);
          toast.error(smartBalancingAmountsRes.val);
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
          usdgToSpend: Number(amountToSell),
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
          console.error("!uniswapEstimate.ok", uniswapEstimate.val);
          toast.error(uniswapEstimate.val);
          return;
        }

        if (!findAmountGlowFromUSDGAmountRes.ok) {
          console.error(
            "!findAmountGlowFromUSDGAmountRes.ok)",
            findAmountGlowFromUSDGAmountRes.val
          );
          toast.error(findAmountGlowFromUSDGAmountRes.val);
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
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            [selectedTokenBuy.label]: formatUnits(estimateRes.val, 6),
          });
        }
        return;
      }
      if (
        selectedTokenBuy.label === "GCTL" &&
        (selectedTokenSell.label === "USDC" ||
          selectedTokenSell.label === "USDG")
      ) {
        if (
          !amountStr ||
          Number(amountStr) <= 0 ||
          isGctlPriceLoading ||
          Number(gctlPrice) === 0
        ) {
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }

        const estimatedGctl = Number(amountToSell) / gctlPriceNumber;

        if (signal.aborted) return; // stale
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: toFixedTruncate(estimatedGctl, 6),
        });
        return;
      }
      const estimateRes = await estimateOutputAmount({
        amountIn: toUnitsDecimal(amountStr, selectedTokenSell.decimals),
      });

      if (estimateRes.ok) {
        if (signal.aborted) return; // stale
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

      toast.error(error?.message || "Failed to estimate swap amount");
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
    }
  };

  const getTokenSellBalance = async () => {
    try {
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

  const handleSelectTokenToSell = (value: TOKENS_ENUM) => {
    const token = Object.values(tokens).find((t) => t.label === value)!;
    if (token.allowedPairs[0]) {
      setSelectedTokenBuy(tokens[token.allowedPairs[0]]);
    }

    setSelectedTokenSell(token);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
  };

  const handleSelectTokenToBuy = (value: TOKENS_ENUM) => {
    // TODO: handle this better

    const token = Object.values(tokens).find((t) => t.label === value)!;

    setSelectedTokenBuy(token);

    setSmartBalancingAmounts(undefined);

    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
  };

  const buttonProps = computeButtonProps();

  // Intercept top-level tab changes to navigate to the homepage tabs
  const handleTopTabsChange = (value: string) => {
    if (value === "launchpad" || value === "mining-center") {
      router.push(`/?tab=${value}`);
      return;
    }
    setTab(value);
  };

  // Fetch only the sell token balance when sell token or wallet readiness changes
  useEffect(() => {
    if (selectedTokenSell && signer && isReady) {
      getTokenSellBalance();
    }
  }, [selectedTokenSell, signer, isReady]);

  // Estimate output when inputs change; no balance fetch here
  useEffect(() => {
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

  const isEstimateLoading =
    estimateQueueAmount !== 0 && amountToSell ? true : false;

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
    <div className="min-h-screen bg-background relative">
      <Image
        src="/images/sections/beam.png"
        alt="Background"
        fill
        className="object-cover dark:hidden"
      />

      {/* Hero Section with Enhanced Gradient */}

      <div className="relative overflow-hidden min-h-screen flex flex-col justify-center items-center py-20 xl:pt-24">
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 lg:px-6 py-2 w-full">
          <Tabs
            value={tab}
            onValueChange={handleTopTabsChange}
            className="lg:items-center"
          >
            <TabsList className="self-center bg-background backdrop-blur-xl rounded-full p-6 border border-border overflow-hidden mx-auto w-fit flex">
              <TabsTrigger value="swap">Swap</TabsTrigger>
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
              <TabsTrigger value="launchpad">Launchpad</TabsTrigger>
            </TabsList>

            <TabsContent value="swap">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-2 lg:mt-4">
                {/* Main Swap Content */}
                <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full p-4 lg:p-6 h-fit mx-auto max-w-[600px] lg:max-w-none">
                  {/* Enhanced Tabs Navigation */}

                  {/* Swap Content */}

                  <div>
                    {/* Enhanced From Token */}
                    <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
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
                                  Number(tokenSellBalance).toLocaleString(
                                    "en-US",
                                    {
                                      maximumFractionDigits: 2,
                                    }
                                  )
                                )}
                              </span>
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                className="h-7 px-2 py-0 text-xs"
                                disabled={
                                  !isConnected ||
                                  isWalletLoading ||
                                  balancesLoading
                                }
                                onClick={() => {
                                  const maxVal = toFixedTruncate(
                                    Number(tokenSellBalance || 0),
                                    selectedTokenSell.toFixed
                                  );
                                  setAmountToSell(maxVal);
                                }}
                              >
                                Max
                              </Button>
                              {/* Test USDC Mint Button - Sepolia Only */}
                              {isOnSepolia &&
                                selectedTokenSell.label === "USDC" && (
                                  <Button
                                    variant="outline"
                                    className="h-7 px-2 py-0 text-xs"
                                    disabled={
                                      !isConnected ||
                                      isWalletLoading ||
                                      isMintingTestUSDC
                                    }
                                    onClick={handleMintTestUSDC}
                                  >
                                    {isMintingTestUSDC
                                      ? "Minting..."
                                      : "Mint Test USDC"}
                                  </Button>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <Input
                            type="text"
                            placeholder="0.00"
                            className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                            value={amountToSell}
                            disabled={!isConnected || isWalletLoading}
                            onChange={(e) => {
                              if (Number(e.target.value) < 0) {
                                setAmountToSell("");
                                return;
                              }
                              setAmountToSell(e.target.value);
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
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Enhanced Swap Direction */}
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button className="bg-background border-4 border-border rounded-full p-2 lg:p-3 hover:bg-muted/30 transition-all duration-200 z-50">
                          <ArrowDownUp className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Enhanced To Token */}
                    <div className="group relative bg-muted/30 rounded-3xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
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

                    {/* Slippage Tolerance Settings */}
                    <div className="bg-muted/20 rounded-xl p-4 border border-border/20 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                            Slippage Tolerance
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs lg:text-sm font-semibold text-primary">
                            {slippageTolerance}%
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setIsSlippageExpanded(!isSlippageExpanded)
                            }
                          >
                            {isSlippageExpanded ? (
                              <>
                                Hide
                                <ChevronUp className="w-3 h-3 ml-1" />
                              </>
                            ) : (
                              <>
                                Edit
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {isSlippageExpanded && (
                        <div className="mt-4 space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            {["1", "2", "5", "10"].map((value) => (
                              <Button
                                key={value}
                                variant={
                                  slippageTolerance === value
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                className={cn(
                                  "h-9 text-sm font-medium transition-all",
                                  slippageTolerance === value && "shadow-md"
                                )}
                                disabled={!isConnected || isWalletLoading}
                                onClick={() => setSlippageTolerance(value)}
                              >
                                {value}%
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your transaction will revert if the price changes
                            unfavorably by more than this percentage.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Transaction Details */}
                    {smartBalancingAmounts &&
                      selectedTokenBuy.label === "GLOW" && (
                        <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-xl p-4 lg:p-5 space-y-4 border border-border/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                              Transaction Details
                            </span>
                          </div>
                          {/* Only show route details if using both Uniswap and Bonding Curve */}
                          {Number(smartBalancingAmounts?.amount_out_glow) >
                            0 && (
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
                          <div className="pt-3 border-t border-border/20">
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
                    <div className="pt-8">
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
                    </div>

                    {/* Enhanced Info Link */}
                    <div className="text-center pt-4">
                      <InstructionsDialog>
                        <Button variant="ghost">
                          <Info className="w-4 h-4 mr-1" />
                          Learn about Glow&apos;s guarded launch
                        </Button>
                      </InstructionsDialog>
                    </div>
                  </div>
                </div>

                {/* Desktop Sidebar - Hidden on mobile, visible on lg and up */}
                <aside className="lg:sticky lg:top-4 h-fit space-y-4">
                  <StatsSidebar
                    marketCap={marketCap}
                    usdcInRedemption={usdcInRedemption}
                    statsLoading={false}
                    isUsdcInRedemptionLoading={isUsdcInRedemptionLoading}
                    isWalletLoading={isWalletLoading}
                  />
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="send">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-2 lg:mt-4">
                <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full p-4 lg:p-6 h-fit mx-auto max-w-[600px] lg:max-w-none">
                  <SendTab
                    tokens={{
                      GLOW: tokens.GLOW,
                      USDG: tokens.USDG,
                      USDC: tokens.USDC,
                    }}
                  />
                </div>
                {/* Desktop Sidebar for Send Tab - Hidden on mobile */}
                <aside className="lg:sticky lg:top-4 h-fit space-y-4">
                  <StatsSidebar
                    marketCap={marketCap}
                    usdcInRedemption={usdcInRedemption}
                    statsLoading={false}
                    isUsdcInRedemptionLoading={isUsdcInRedemptionLoading}
                    isWalletLoading={isWalletLoading}
                  />
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="liquidity">
              <PositionsView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {/* Dialogs */}
      <UsdcToTokenDialog
        isOpen={isDialogOpen}
        amount={currentTokenEstimatedOutputAmount}
        amountToSell={amountToSell}
        selectedTokenSell={selectedTokenSell}
        selectedTokenBuy={selectedTokenBuy}
        smartBalancingAmounts={smartBalancingAmounts}
        swapUSDCToUSDG={swapUSDCToUSDG}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              Promise.all([
                setUsdcBalanceForSigner(),
                setUsdgBalanceForSigner(),
                getTokenSellBalance(),
                refreshBalances(),
              ]);
            }

            // Refresh the page data
            startTransition(router.refresh);
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
        onOpenChange={(open) => {
          setIsGlowToUsdcDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              Promise.all([
                setUsdcBalanceForSigner(),
                setUsdgBalanceForSigner(),
                getTokenSellBalance(),
                refreshBalances(),
              ]);
            }

            // Refresh the page data
            startTransition(router.refresh);
          }
        }}
      />
      <UsdgToUsdcRedemptionDialog
        isOpen={isUsdgToUsdcRedemptionDialogOpen}
        amountToRedeem={amountToSell}
        onOpenChange={(open) => {
          setIsUsdgToUsdcRedemptionDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);

            // Refresh all balances
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              Promise.all([
                setUsdcBalanceForSigner(),
                setUsdgBalanceForSigner(),
                getTokenSellBalance(),
                refreshBalances(),
              ]);
            }

            // Refresh the page data
            startTransition(router.refresh);
          }
        }}
      />
      {/* GCTL Pre-transaction Dialog (approvals + mint submit) */}
      <TransactionDialog
        open={isGctlPreTxDialogOpen}
        onOpenChange={(open) => {
          setIsGctlPreTxDialogOpen(open);
          if (!open) setGctlPreTxError(null);
        }}
        isSubmitting={isGctlPreTxSubmitting}
        isError={!!gctlPreTxError}
        title="Prepare Purchase"
        processingTitle="Submitting Transaction"
        description="Approve token spending and confirm the transaction in your wallet."
        processingDescription="Please approve and wait while we submit your transaction."
        transactionDetails={
          [
            {
              label: "You Pay",
              value: Number(amountToSell || "0").toLocaleString("en-US", {
                maximumFractionDigits: 6,
              }),
              unit: selectedTokenSell.label,
            },
            {
              label: "You Receive",
              value: Number(
                estimatedOutputAmount[selectedTokenBuy.label] || "0"
              ).toLocaleString("en-US", { maximumFractionDigits: 6 }),
              unit: "GCTL",
            },
          ] as TransactionDetail[]
        }
        errorDescription={gctlPreTxError || undefined}
      />
      {/* GCTL Processing & Success Modals */}
      <ProcessingModal
        isOpen={isProcessingTransaction}
        trackingTxHash={trackingTxHash}
        onClose={() => {
          setIsProcessingTransaction(false);
          setShowSuccess(false);
          setTrackingTxHash(null);
          setAmountToSell("");
          setEstimatedOutputAmount(defaultTokensEstimate);
          setSmartBalancingAmounts(undefined);
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
