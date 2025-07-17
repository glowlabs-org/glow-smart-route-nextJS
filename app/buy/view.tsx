/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BigNumber, ethers } from "ethers";
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
import { addresses } from "@glowlabs-org/guarded-launch-ethers-sdk";
import { usePurchaseImpactPower } from "@/hooks/usePurchaseImpactPower";
import { Input } from "@/components/ui/input";
import { useAccount } from "wagmi";
import { Loader2, Settings, ArrowDownUp, Info } from "lucide-react";
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
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { useDebouncedCallback } from "use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { useERC20 } from "@/hooks/useERC20";
import {
  USDG_REDEMPTION_ADDRESS,
  useUSDGRedemption,
} from "@/hooks/useUSDGRedemption";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Image from "next/image";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { publicClient } from "@/web3/web3/clients/publicClient";

const tokens = {
  USDG: {
    label: "USDG",
    address: addresses.usdg,
    decimals: 6,
    allowedPairs: ["GLOW", "IMPACT POWER POINTS", "USDC"],
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
    allowedPairs: ["GLOW", "USDG", "IMPACT POWER POINTS"],
    toFixed: 6,
  },
  ["IMPACT POWER POINTS"]: {
    //@ts-ignore
    label: "IMPACT POWER POINTS",
    address: addresses.impactCatalyst,
    //@ts-ignore
    decimals: 12,
    //@ts-ignore
    allowedPairs: [],
    toFixed: 6,
  },
} as const;

const defaultTokensEstimate = {
  GLOW: "0",
  USDG: "0",
  USDC: "0",
  "IMPACT POWER POINTS": "0",
};

type TOKENS_ENUM = keyof typeof tokens;
export type Token = (typeof tokens)[keyof typeof tokens];

export default function View({
  glowPrice,
  earlyLiquidityCurrentPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
  impactPowerPrice,
}: // totalProtocolFeesLast30days,
{
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
  impactPowerPrice: string;
  // totalProtocolFeesLast30days: string;
}) {
  const [estimatedOutputAmount, setEstimatedOutputAmount] = useState<
    typeof defaultTokensEstimate
  >(defaultTokensEstimate);
  const [isTransitionStarted, startTransition] = React.useTransition();
  const [estimateQueueAmount, setEstimateQueueAmount] = useState<number>(0);
  const [isRpcAvailable, setIsRpcAvailable] = useState<boolean>(true);
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isGlowToUsdcDialogOpen, setIsGlowToUsdcDialogOpen] =
    useState<boolean>(false);
  const [amountToSell, setAmountToSell] = React.useState<string>("0");
  const [amountToSend, setAmountToSend] = React.useState<string>("0");
  const [selectedTokenSell, setSelectedTokenSell] = useState<Token>(
    tokens.USDC
  );
  const [selectedTokenSend, setSelectedTokenSend] = useState<Token>(
    tokens.USDG
  );
  const [slippageTolerance, setSlippageTolerance] = useState("1");
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const [tokenSellBalance, setTokenSellBalance] = useState<string>("0");
  const [tokenSendBalance, setTokenSendBalance] = useState<string>("0");
  const [selectedTokenBuy, setSelectedTokenBuy] = useState<Token>(tokens.GLOW);
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  // Add a general loading state check
  const isWalletLoading = isConnecting || isReconnecting;

  const [sendToAddress, setSendToAddress] = useState<string>("");
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
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  const {
    purchaseGlowEarlyLiquidity,
    glowPurchaseState,
    findAmountGlowFromUSDGAmount,
    getSmartBalancingAmounts,
    estimateGasForPurchaseGlowEarlyLiquidity,
  } = usePurchaseGlow();
  const { swapUSDCToUSDG, estimateGasForswapUSDCToUSDG } = useSwapUSDCToUSDG();
  const { purchaseImpactPoints, estimateUSDGToImpactPoints } =
    usePurchaseImpactPower();
  const signer = useEthersSigner();
  const { sendTokens, isReady: isSendTokensReady } = useERC20({ signer });
  const {
    usdcInRedemption,
    redeemUSDGForUSDC,
    estimateGasForRedeemUSDG,
    getUSDCBalanceOfRedemptionContract,
  } = useUSDGRedemption();

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

  async function purchaseImpactPower(
    amountToBuy: string,
    amountUSDGToSpend: BigNumber
  ) {
    const amountImpactPointsDesired = BigNumber.from(amountToBuy);
    const res = await purchaseImpactPoints({
      amountUSDGToSpend: amountUSDGToSpend,
      minimumImpactPowerToBuy: amountImpactPointsDesired.mul(98).div(100), //allow for a 2% deviation
    });
    return res;
  }

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
          Number(ethers.utils.formatUnits(usdgBalance.toString(), 6)) >=
            Number(amountToSell)
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
                    if (selectedTokenBuy.label === "IMPACT POWER POINTS") {
                      handleSelectTokenToBuy("IMPACT POWER POINTS");
                    }
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
          usdgBalance?.lt(0) &&
          usdgBalance?.lt(ethers.utils.parseUnits(amountToSell, 6))
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

  const getTokenToSendBalance = () => {
    return Number(
      selectedTokenSend.label === "GLOW"
        ? glowBalance
          ? ethers.utils.formatUnits(glowBalance, selectedTokenSend.decimals)
          : "0"
        : selectedTokenSend.label === "USDG"
        ? usdgBalance
          ? ethers.utils.formatUnits(usdgBalance, selectedTokenSend.decimals)
          : "0"
        : "0"
    );
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

  const handleBuy = async () => {
    const amountIn = ethers.utils.parseUnits(
      amountToSell,
      selectedTokenSell.decimals
    );

    try {
      setPendingTx(true);
      if (
        selectedTokenBuy.label === "GLOW" &&
        selectedTokenSell.label === "USDG"
      ) {
        // buy glow with uniswap
        if (smartBalancingAmounts?.amount_in_uni) {
          const swapRes = await swap({
            amount: ethers.utils.parseUnits(
              toFixedTruncate(Number(smartBalancingAmounts.amount_in_uni), 6),
              "6"
            ),
            slippagePercentTenThousandDenominator: BigNumber.from(
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
              slippagePointsTenThousandths: BigNumber.from(
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
        const redeemRes = await redeemUSDGForUSDC(amountIn);
        handleResponseMessage(redeemRes);
      } else if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // Open the GLOW to USDC dialog instead of executing directly
        setIsGlowToUsdcDialogOpen(true);
        setPendingTx(false);
        return;
      } else if (
        //@ts-ignore
        selectedTokenBuy.label === "IMPACT POWER POINTS" &&
        selectedTokenSell.label === "USDG"
      ) {
        //TODO: check if buy works ?
        const amountToBuy = ethers.utils.parseUnits(
          currentTokenEstimatedOutputAmount,
          12
        );

        const purchaseImpactPowerRes = await purchaseImpactPower(
          amountToBuy.toString(),
          amountIn
        );
        handleResponseMessage(purchaseImpactPowerRes);
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
          amount: ethers.utils.parseUnits(
            toFixedTruncate(Number(amount_usdg_in_uniswap), 6),
            "6"
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
        slippagePointsTenThousandths: BigNumber.from(200),
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
          amountIn: ethers.utils.parseUnits(amountToSell, "6"),
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
              ethers.utils.parseUnits(amountToSell, "6"),
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
          amount_in_glow_bonding_curve: toFixedTruncate(
            amountsWithFees.amount_usdg_in_bonding_curve,
            6
          ),
          amount_out_glow: toFixedTruncate(
            amountsWithFees.amount_out_glow_bonding_curve,
            18
          ),
          amount_in_uni: toFixedTruncate(
            amountsWithFees.amount_usdg_in_uniswap,
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
          await findAmountGlowFromUSDGAmount(
            ethers.utils.parseUnits(amountToSell, "6")
          );

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
          ethers.utils.formatUnits(uniswapEstimate.val.toString(), "18")
        );
        const estimatedOutputAmountFormated = Number(
          ethers.utils.formatUnits(
            findAmountGlowFromUSDGAmountRes.val.toString(),
            "18"
          )
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
          amountIn: ethers.utils.parseUnits(
            amountToSell,
            selectedTokenSell.decimals
          ),
        });

        if (estimateRes.ok) {
          // USDG to USDC is 1:1, so the USDG amount equals USDC amount
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            [selectedTokenBuy.label]: ethers.utils.formatUnits(
              estimateRes.val.toString(),
              "6"
            ),
          });
        }
        return;
      }
      if (
        //@ts-ignore
        selectedTokenBuy.label === "IMPACT POWER POINTS" &&
        (selectedTokenSell.label === "USDG" ||
          selectedTokenSell.label === "USDC")
      ) {
        const estimateRes = await estimateUSDGToImpactPoints({
          amountUSDGToSpend: ethers.utils.parseUnits(
            amountToSell,
            selectedTokenSell.decimals
          ),
        });

        if (estimateRes.ok) {
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            [selectedTokenBuy.label]: ethers.utils.formatUnits(
              estimateRes.val.toString(),
              "12"
            ),
          });
        }

        return;
      }
      const estimateRes = await estimateOutputAmount({
        amountIn: ethers.utils.parseUnits(
          amountToSell,
          selectedTokenSell.decimals
        ),
      });

      if (estimateRes.ok) {
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: ethers.utils.formatUnits(
            estimateRes.val.toString(),
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
    setBalancesLoading(true);
    const balance = await getBalance();
    await refreshBalances();
    if (balance.ok) {
      setTokenSellBalance(
        ethers.utils.formatUnits(balance.val, selectedTokenSell.decimals)
      );
    }
    setBalancesLoading(false);
  };

  const handleSelectTokenToSell = (value: TOKENS_ENUM) => {
    const token = Object.values(tokens).find((t) => t.label === value)!;
    if (token.allowedPairs[0]) {
      setSelectedTokenBuy(tokens[token.allowedPairs[0]]);
    }

    setSelectedTokenSell(token);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("0");
    setEstimatedOutputAmount(defaultTokensEstimate);
  };

  const handleSelectTokenToBuy = (value: TOKENS_ENUM) => {
    // TODO: handle this better
    //@ts-ignore
    if (value === "IMPACT POWER POINTS") {
      setSelectedTokenBuy(tokens["IMPACT POWER POINTS"]);
    } else {
      const token = Object.values(tokens).find((t) => t.label === value)!;

      setSelectedTokenBuy(token);
    }
    setSmartBalancingAmounts(undefined);

    setAmountToSell("0");
    setEstimatedOutputAmount(defaultTokensEstimate);
  };

  const handleSendToken = async () => {
    if (!isSendTokensReady) {
      toast.error("send tokens hook not ready");
      return;
    }
    // verif if amountToSend is positive and valid number
    if (Number.isNaN(Number(amountToSend)) || Number(amountToSend) <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (ethers.utils.isAddress(sendToAddress)) {
      setPendingTx(true);
      try {
        const amountToSendFormated = ethers.utils.parseUnits(
          amountToSend,
          selectedTokenSend.decimals
        );

        await sendTokens(
          selectedTokenSend.label as SYMBOLS,
          sendToAddress as `0x${string}`,
          amountToSendFormated
        );

        await getTokenSellBalance();
        setPendingTx(false);
        toast.success("Transaction successful");
      } catch (error) {
        console.log(error);
        toast.error("Transaction failed");
        setPendingTx(false);
      }
    } else {
      toast.error("Invalid address");
    }
  };

  const handleSelectTokenToSend = (value: TOKENS_ENUM) => {
    const token = Object.values(tokens).find((t) => t.label === value)!;
    setSelectedTokenSend(token);
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

  // Add effect to handle stats loading
  useEffect(() => {
    if (marketCap && glowPrice && usdcRewardPool) {
      setStatsLoading(false);
    }
  }, [marketCap, glowPrice, usdcRewardPool]);

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
          ethers.utils.parseUnits(usdgWithdrawAmount, 6),
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

  async function handleUSDGWithdraw() {
    setIsWithdrawing(true);
    try {
      const amount = ethers.utils.parseUnits(usdgWithdrawAmount, 6);
      const res = await redeemUSDGForUSDC(amount);
      if (res.ok) {
        toast.success("USDG successfully redeemed for USDC");
        setUsdgWithdrawAmount("0");
        setIsUsdcInRedemptionLoading(true);
        await getUSDCBalanceOfRedemptionContract(); // Refresh USDC in contract after redeem
        setIsUsdcInRedemptionLoading(false);
      } else {
        toast.error(res.val);
      }
    } catch (error: any) {
      toast.error(error?.message || "Redemption failed");
    } finally {
      setIsWithdrawing(false);
    }
  }

  useEffect(() => {
    async function checkRpc() {
      try {
        await publicClient.getBlockNumber();
        setIsRpcAvailable(true);
      } catch (error) {
        console.error("RPC connectivity error:", error);
        setIsRpcAvailable(false);
      }
    }

    checkRpc();
  }, []);

  // Utility function to format token balances consistently
  const formatTokenBalance = (
    balance: BigNumber | null,
    decimals: number = 2
  ): string => {
    if (!balance) return "-";
    return ethers.utils.formatUnits(balance, decimals).replace(/\.0+$/, "");
  };

  if (!isRpcAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center glow-gradient-a">
        <div className="bg-card rounded-md border border-border p-8 text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-semibold">Service Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            We&rsquo;re having trouble connecting to the blockchain. Please
            reload the page or try again later.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-12"
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen glow-gradient-a">
      {/* Hero Section with Enhanced Gradient */}
      <div className="relative overflow-hidden min-h-screen">
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-6 lg:px-12 xl:px-16 relative z-10 min-h-screen flex items-center justify-center">
          {/* Hero Content */}
          <div className="flex flex-col items-center justify-center lg:flex-row gap-6 lg:gap-8 w-full">
            {/* Stats Sidebar */}
            <div className="w-full lg:max-w-64 xl:max-w-72 flex-shrink-0">
              <div className="bg-white rounded-md border border-border p-4 lg:p-6 space-y-4">
                {/* Sidebar Header */}
                <div className="pb-4 border-b border-border/30">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Market Overview
                  </h3>
                </div>

                {/* Stats Items */}
                <div className="flex flex-row lg:flex-col justify-between gap-4">
                  <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default hidden lg:block">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        Market Cap
                      </div>
                    </div>
                    <div className="text-lg lg:text-xl font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        <NumberTicker value={Number(marketCap)} />
                      )}
                    </div>
                  </div>

                  <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        GLOW Price
                      </div>
                    </div>
                    <div className="text-lg lg:text-xl font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-20 h-6 inline-block" />
                      ) : (
                        Number(glowPrice).toFixed(6)
                      )}
                    </div>
                  </div>

                  <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        Reward Pool
                      </div>
                    </div>
                    <div className="text-lg lg:text-xl font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        <NumberTicker value={Number(usdcRewardPool)} />
                      )}
                    </div>
                  </div>

                  <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default hidden lg:block">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        USDC Available
                      </div>
                    </div>
                    <div className="text-lg lg:text-xl font-bold">
                      ${" "}
                      {isUsdcInRedemptionLoading || isWalletLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        <NumberTicker value={usdcInRedemption} />
                      )}
                    </div>
                    {isUsdcInRedemptionLoading && !isWalletLoading && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        Updating...
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Info Section */}
                <div className="pt-4 border-t border-border/30 hidden lg:block">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">ETH Price</span>
                      <span className="font-medium">
                        ${ethPriceInUSD ? ethPriceInUSD.toFixed(0) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex w-full justify-center">
              <div className="bg-card rounded-md border border-border overflow-hidden w-full max-w-sm">
                {/* Enhanced Tabs Navigation */}
                <Tabs defaultValue="swap" className="w-full">
                  <div className="p-4 lg:p-6 pb-0 lg:pb-0 border-b border-border/30">
                    <TabsList className="w-full justify-center">
                      <TabsTrigger value="swap">Swap</TabsTrigger>
                      <TabsTrigger value="send">Send</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4 lg:p-6 py-0">
                    {/* Swap Content */}
                    <TabsContent value="swap">
                      <div>
                        {/* Enhanced Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg lg:text-xl font-semibold">
                              Swap Tokens
                            </h3>
                            <p className="text-xs lg:text-sm text-muted-foreground">
                              Exchange tokens at the best available rates
                            </p>
                          </div>
                          {/* <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full hover:bg-muted/50 transition-colors"
                            >
                              <Settings className="w-5 h-5" />
                            </Button> */}
                        </div>

                        {/* Enhanced From Token */}
                        <div className="group relative bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30 hover:border-border/60 transition-all duration-300">
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
                                    setAmountToSell("0");
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
                              <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-md border-border bg-white font-medium">
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
                            <button className="bg-white border-4 border-glow-light-grey rounded-full p-2 lg:p-3 hover:bg-glow-medium-grey transition-all duration-200 z-50">
                              <ArrowDownUp className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Enhanced To Token */}
                        <div className="group relative  bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30 hover:border-border/60 transition-all duration-300">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                              You receive
                            </span>
                            {isEstimateLoading && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
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
                                      : "0.00"
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
                              <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-md border-border bg-white font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedTokenSell.allowedPairs.map((token) => (
                                  <SelectItem key={token} value={token}>
                                    {token === "IMPACT POWER POINTS"
                                      ? "Impact Power"
                                      : token}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Enhanced Transaction Details */}
                        {smartBalancingAmounts &&
                          selectedTokenBuy.label === "GLOW" && (
                            <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-md p-4 lg:p-5 space-y-4 border border-border/20">
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
                        <div className="pt-4">
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
                            <Button
                              variant="ghost"
                              className="text-xs lg:text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Info className="w-4 h-4 mr-1" />
                              Learn about Glow&apos;s guarded launch
                            </Button>
                          </InstructionsDialog>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Send Content */}
                    <TabsContent value="send">
                      <div className="space-y-4">
                        <div className="mb-6">
                          <h3 className="text-lg lg:text-xl font-semibold mb-2">
                            Send Tokens
                          </h3>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            Transfer tokens to any wallet address
                          </p>
                        </div>

                        {/* Enhanced Amount Input */}
                        <div className="bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30">
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
                                className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
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
                              <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-md border-border bg-white font-medium">
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
                        <div className="bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                              Recipient Address
                            </span>
                          </div>
                          <Input
                            type="text"
                            placeholder="0x..."
                            className="w-full bg-transparent border-0 p-0 h-auto text-sm lg:text-lg font-mono focus-visible:ring-0 placeholder:text-muted-foreground/40 break-all"
                            value={sendToAddress}
                            disabled={!isConnected || isWalletLoading}
                            onChange={(e) => setSendToAddress(e.target.value)}
                          />
                        </div>

                        {/* Enhanced Send Button */}
                        <div className="pt-4">
                          {isConnected ? (
                            <Button
                              disabled={
                                getSendButtonProps().disabled ||
                                pendingTx ||
                                isEstimateLoading
                              }
                              onClick={handleSendToken}
                              className="w-full h-12 lg:h-16"
                            >
                              {pendingTx && (
                                <div className="mr-3">
                                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                              {pendingTx
                                ? "Sending..."
                                : getSendButtonProps().label}
                            </Button>
                          ) : (
                            <ConnectButton variant="default" />
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Redeem Content */}
                    <TabsContent value="redeem">
                      <div className="space-y-4">
                        <div className="mb-6">
                          <h3 className="text-lg lg:text-xl font-semibold mb-2">
                            USDG Redemption
                          </h3>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            Redeem USDG tokens for USDC at a 1:1 ratio
                          </p>
                        </div>

                        {/* Enhanced USDG Amount Input */}
                        <div className="bg-gradient-to-r from-glow-medium-grey/50 to-glow-medium-grey/40 rounded-md p-4 lg:p-6 border border-border/30">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                              USDG to Redeem
                            </span>
                            {isConnected && (
                              <span className="text-xs lg:text-sm text-muted-foreground">
                                Balance:{" "}
                                <span className="font-medium">
                                  {formatTokenBalance(usdgBalance)}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <Input
                                type="text"
                                placeholder="0.00"
                                className={`text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
                                  usdgWithdrawAmount &&
                                  usdgBalance &&
                                  !usdgBalance.isZero() &&
                                  Number(usdgWithdrawAmount) >
                                    Number(
                                      ethers.utils.formatUnits(usdgBalance, 6)
                                    )
                                    ? "text-destructive"
                                    : ""
                                }`}
                                value={usdgWithdrawAmount}
                                disabled={!isConnected || isWithdrawing}
                                onChange={(e) => {
                                  if (Number(e.target.value) < 0) {
                                    setUsdgWithdrawAmount("0");
                                    return;
                                  }
                                  setUsdgWithdrawAmount(e.target.value);
                                }}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                !usdgBalance ||
                                usdgBalance.isZero() ||
                                isWithdrawing
                              }
                              onClick={() => {
                                if (usdgBalance && !usdgBalance.isZero()) {
                                  setUsdgWithdrawAmount(
                                    formatTokenBalance(usdgBalance)
                                  );
                                }
                              }}
                              className="shrink-0"
                            >
                              Max
                            </Button>
                          </div>
                        </div>

                        {/* Enhanced USDC Output Display */}
                        <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-md p-4 lg:p-6 border border-border/20">
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                              You receive (USDC)
                            </span>
                            <span className="text-lg lg:text-2xl font-bold break-all">
                              {usdgWithdrawAmount &&
                              !isNaN(Number(usdgWithdrawAmount)) &&
                              Number(usdgWithdrawAmount) > 0
                                ? Number(usdgWithdrawAmount).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 6,
                                    }
                                  )
                                : "0.00"}
                            </span>
                          </div>
                          {estimatedWithdrawGas && (
                            <div className="mt-3 pt-3 border-t border-border/20">
                              <div className="flex items-center justify-between text-xs lg:text-sm">
                                <span className="text-muted-foreground">
                                  Network fee
                                </span>
                                <span className="font-medium">
                                  ~${estimatedWithdrawGas}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Enhanced Redeem Button */}
                        <div className="pt-4">
                          {isConnected ? (
                            <Button
                              disabled={
                                isWithdrawing ||
                                !usdgWithdrawAmount ||
                                Number(usdgWithdrawAmount) <= 0
                              }
                              onClick={async () => {
                                await handleUSDGWithdraw();
                                setUsdgBalanceForSigner();
                              }}
                              className="w-full h-12 lg:h-16"
                            >
                              {isWithdrawing && (
                                <div className="mr-3">
                                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                              {isWithdrawing ? "Redeeming..." : "Redeem USDG"}
                            </Button>
                          ) : (
                            <ConnectButton variant="default" />
                          )}
                        </div>

                        {/* Enhanced Contract Link */}
                        <div className="text-center pt-4">
                          <a
                            href={`https://etherscan.io/address/${USDG_REDEMPTION_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs lg:text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
                          >
                            View redemption contract
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
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
        purchaseImpactPower={purchaseImpactPower}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Reset input states
            setAmountToSell("0");
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
        slippagePointsTenThousandths={BigNumber.from(
          Number(slippageTolerance) * 100
        )}
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
            setAmountToSell("0");
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
    </div>
  );
}
