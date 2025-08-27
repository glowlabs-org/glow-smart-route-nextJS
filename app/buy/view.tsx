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
import { toast } from "sonner";
import { Result } from "ts-results";
import { useSwap } from "@/hooks/useSwap";
import { Input } from "@/components/ui/input";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useForwarder } from "@glowlabs-org/utils/browser";
import { CHAIN_ID } from "@/web3/constants";
import { ProcessingModal } from "@/components/buy-gctl/processing-modal";
import { ArrowDownUp, Info } from "lucide-react";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { SYMBOLS, useER20Balances } from "@/hooks/useERC20Balances";
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
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { useDebouncedCallback } from "use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SendTab } from "./send-tab";
import { useQueryState } from "nuqs";

import { addresses } from "@/web3/constants/addresses";
import { MaxUint256 } from "ethers";
import { cn } from "@/lib/utils";
import Image from "next/image";
import PositionsView from "../positions/view";
import { useGctlApi } from "@/hooks/useGctlApi";
import { WalletDashboardTab } from "@/components/wallet/wallet-dashboard-tab";
import { RestakeAssistant } from "@/app/wallet/restake-assistant";
import { UnstakeDialog } from "@/app/wallet/unstake-dialog";
import { ContributeDialog } from "@/components/dialogs/ContributeDialog";

const tokens = {
  USDG: {
    label: "USDG",
    address: addresses.usdg,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC", "GCTL"],
    toFixed: 6,
  },
  GLOW: {
    label: "GLOW",
    address: addresses.glow,
    decimals: 18,
    allowedPairs: ["USDG", "USDC"],
    toFixed: 6,
  },
  USDC: {
    label: "USDC",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`,
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
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const [tokenSellBalance, setTokenSellBalance] = useState<string>("0");
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  // Add a general loading state check
  const isWalletLoading = isConnecting || isReconnecting;

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

  const [balancesLoading, setBalancesLoading] = useState<boolean>(true);
  // GCTL swap & modal state
  const [isProcessingTransaction, setIsProcessingTransaction] =
    useState<boolean>(false);
  const [trackingTxHash, setTrackingTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [processedGctlAmount, setProcessedGctlAmount] = useState<string>("0");

  const [isRestakeOpen, setIsRestakeOpen] = useState(false);
  const [isUnstakeOpen, setIsUnstakeOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);

  // -------------------------------------------------------------------
  // URL PARAM STATE (txId)
  // -------------------------------------------------------------------
  const [txIdParam, setTxIdParam] = useQueryState("txId", {
    defaultValue: "",
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
  const { mintGCTL, checkTokenAllowance, approveToken } = useForwarder(
    signer as any,
    chainIdNum
  );

  const { gctlPrice, gctlPriceNumber, isGctlPriceLoading } =
    useGctlApi(address);

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
    getBalance,
    isReady,
    usdcBalance,
    setUsdcBalanceForSigner,
    usdgBalance,
    setUsdgBalanceForSigner,
    refreshBalances,
    glowBalance,
  } = useER20Balances({
    symbol: selectedTokenSell.label as SYMBOLS,
    signer,
  });
  const debouncedEstimate = useDebouncedCallback(
    async (amountToSell: string) => {
      try {
        setEstimateQueueAmount((prev) => prev + 1);
        await estimateAmount();
        setEstimateQueueAmount((prev) => prev - 1);
      } catch (error) {
        setEstimateQueueAmount((prev) => prev - 1);
      }
    },
    500
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
    } else {
      toast.error(data.val);
    }
  }

  function computeButtonProps() {
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
          label: `Insufficient Funds: Click Here To Buy USDC on Uniswap`,
          disabled: false,
          callback: () => window.open("https://app.uniswap.org/swap", "_blank"),
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
          usdcBalance < BigInt(parseUnits(amountToSell, 6)) &&
          usdgBalance &&
          usdgBalance >= BigInt(parseUnits(amountToSell, 6))
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
        return {
          label: `SWAP`,
          disabled: false,
          callback: () => {
            if (selectedTokenBuy.label === "GCTL") {
              handleBuy();
            } else {
              setIsDialogOpen(true);
            }
          },
        };
      } else if (
        selectedTokenSell.label === "USDG" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        return {
          label: `SWAP`,
          disabled: false,
          callback: () => {
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
    const amountIn = parseUnits(amountToSell, selectedTokenSell.decimals);

    try {
      setPendingTx(true);
      if (
        selectedTokenBuy.label === "GLOW" &&
        selectedTokenSell.label === "USDG"
      ) {
        // buy glow with uniswap
        if (smartBalancingAmounts?.amount_in_uni) {
          const swapRes = await swap({
            amount: parseUnits(
              toFixedTruncate(Number(smartBalancingAmounts.amount_in_uni), 6),
              6
            ),
            slippagePercentTenThousandDenominator: BigInt(
              Number(slippageTolerance) * 100
            ),
          });
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
        setIsUsdgToUsdcRedemptionDialogOpen(true);
        setPendingTx(false);
        return;
      } else if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // Open the GLOW to USDC dialog instead of executing directly
        setIsGlowToUsdcDialogOpen(true);
        setPendingTx(false);
        return;
      } else if (
        selectedTokenBuy.label === "GCTL" &&
        (selectedTokenSell.label === "USDC" ||
          selectedTokenSell.label === "USDG")
      ) {
        try {
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

          setTrackingTxHash(txHash);
          setTxIdParam(txHash); // persist txId to URL
          setProcessedGctlAmount(estimatedOutputAmount[selectedTokenBuy.label]);

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
    } catch (error) {
      console.log(error);

      setPendingTx(false);
      toast.error("Transaction failed");
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

  const estimateAmount = async () => {
    try {
      if (selectedTokenBuy.label === "GLOW") {
        if (!amountToSell || amountToSell === "0") {
          setSmartBalancingAmounts(undefined);
          return;
        }
        const uniswapEstimate = await estimateOutputAmount({
          amountIn: parseUnits(amountToSell, 6),
        });
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: Number(amountToSell),
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
          Number(smartBalancingAmountsRes.val.amount_in_uni)
        );

        let estimatedGasForswapUSDCToUSDG = "0";
        if (selectedTokenSell.label === "USDC") {
          const estimatedGasForswapUSDCToUSDGRes =
            await estimateGasForswapUSDCToUSDG(
              parseUnits(amountToSell, 6),
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
            smartBalancingAmountsRes.val.amount_in_uni
          ),
          amount_usdg_in_bonding_curve: Number(
            smartBalancingAmountsRes.val.amount_in_glow_bonding_curve
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
          await findAmountGlowFromUSDGAmount(parseUnits(amountToSell, 6));

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

        // If we have smart balancing amounts, use the total from both routes
        let finalOutput;
        if (smartBalancingAmounts) {
          const uniswapOutput = Number(smartBalancingAmounts.amount_out_uni);
          const bondingCurveOutput = Number(
            smartBalancingAmounts.amount_out_glow
          );
          finalOutput = uniswapOutput + bondingCurveOutput;
        } else {
          // Fallback to max output for non-smart balancing scenarios
          finalOutput = Math.max(
            estimatedUniswapOutputAmount,
            estimatedOutputAmountFormated
          );
        }

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
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountToSell,
        });
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "USDG"
      ) {
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountToSell,
        });
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // For GLOW -> USDC, we need to estimate GLOW -> USDG first
        const estimateRes = await estimateGlowToUSDG({
          amountIn: parseUnits(amountToSell, selectedTokenSell.decimals),
        });

        if (estimateRes.ok) {
          // USDG to USDC is 1:1, so the USDG amount equals USDC amount
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
          !amountToSell ||
          Number(amountToSell) <= 0 ||
          isGctlPriceLoading ||
          Number(gctlPrice) === 0
        ) {
          setEstimatedOutputAmount(defaultTokensEstimate);
          return;
        }

        const estimatedGctl = Number(amountToSell) / gctlPriceNumber;
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: toFixedTruncate(estimatedGctl, 6),
        });
        return;
      }
      const estimateRes = await estimateOutputAmount({
        amountIn: parseUnits(amountToSell, selectedTokenSell.decimals),
      });

      if (estimateRes.ok) {
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: formatUnits(
            estimateRes.val,
            selectedTokenBuy.decimals
          ),
        });
      }
    } catch (error: any) {
      console.error("Error in estimateAmount:", error);
      toast.error(error?.message || "Failed to estimate swap amount");
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
    }
  };

  const getTokenSellBalance = async () => {
    try {
      setBalancesLoading(true);
      const balance = await getBalance();
      await refreshBalances();
      if (balance.ok) {
        setTokenSellBalance(
          formatUnits(balance.val, selectedTokenSell.decimals)
        );
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

  useEffect(() => {
    if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
      getTokenSellBalance();
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
  }, [selectedTokenSell, selectedTokenBuy, amountToSell, signer, isReady]);

  // Add effect to fetch USDC balance when wallet connects
  useEffect(() => {
    const fetchUsdcInRedemption = async () => {
      if (isConnected && !isWalletLoading) {
        setIsUsdcInRedemptionLoading(true);
        await getUSDCBalanceOfRedemptionContract();
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
        className="object-cover"
      />

      {/* Hero Section with Enhanced Gradient */}

      <div className="relative overflow-hidden min-h-screen flex flex-col justify-center items-center pt-20 xl:pt-24">
        <Tabs defaultValue="swap" className="items-center">
          <TabsList className="self-center bg-background backdrop-blur-xl rounded-full p-6 border border-border overflow-hidden">
            <TabsTrigger value="swap">Swap</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>

            <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          </TabsList>

          <TabsContent value="swap">
            <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full max-w-[600px] p-2 lg:p-6">
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
                      <span className="text-xs lg:text-sm text-muted-foreground">
                        Balance:{" "}
                        <span className="font-medium">
                          {isWalletLoading || balancesLoading ? (
                            <Skeleton className="w-16 h-4 inline-block" />
                          ) : (
                            toFixedTruncate(Number(tokenSellBalance), 2)
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

                {/* Enhanced Transaction Details */}
                {smartBalancingAmounts && selectedTokenBuy.label === "GLOW" && (
                  <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-xl p-4 lg:p-5 space-y-4 border border-border/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                        Transaction Details
                      </span>
                    </div>
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
                  {!isConnected && !isWalletLoading ? (
                    <ConnectButton variant="default" />
                  ) : isWalletLoading ? (
                    <ConnectButton variant="default" />
                  ) : (
                    <Button
                      disabled={
                        buttonProps.disabled ||
                        pendingTx ||
                        isEstimateLoading ||
                        balancesLoading
                      }
                      onClick={buttonProps.callback}
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
          </TabsContent>

          <TabsContent value="send">
            <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full max-w-[600px] p-2 lg:p-6">
              <SendTab
                isConnected={isConnected}
                isWalletLoading={isWalletLoading}
                balancesLoading={balancesLoading}
                glowBalance={glowBalance}
                usdgBalance={usdgBalance}
                signer={signer}
                refreshBalances={refreshBalances}
                tokens={{
                  GLOW: tokens.GLOW,
                  USDG: tokens.USDG,
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="liquidity">
            <PositionsView />
          </TabsContent>
        </Tabs>
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

      {/* Wallet Tab Modals */}
      <RestakeAssistant
        isOpen={isRestakeOpen}
        onClose={() => setIsRestakeOpen(false)}
        regionYields={[]}
      />
      <UnstakeDialog
        isOpen={isUnstakeOpen}
        onClose={() => setIsUnstakeOpen(false)}
        regionYields={[]}
        gctlUnstaking={"0"}
      />
      <ContributeDialog
        open={isContributeOpen}
        onOpenChange={setIsContributeOpen}
      />
    </div>
  );
}
