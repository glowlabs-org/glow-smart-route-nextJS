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
import { Loader2 } from "lucide-react";
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
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import { useDebouncedCallback } from "use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { TabsList } from "@radix-ui/react-tabs";
import { useERC20 } from "@/hooks/useERC20";

const tokens = {
  USDG: {
    label: "USDG",
    address: addresses.usdg,
    decimals: 6,
    allowedPairs: ["GLOW", "GCC", "IMPACT POWER POINTS"],
    toFixed: 6,
  },
  GLOW: {
    label: "GLOW",
    address: addresses.glow,
    decimals: 18,
    allowedPairs: ["USDG"],
    toFixed: 2,
  },
  USDC: {
    label: "USDC",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`,
    decimals: 6,
    allowedPairs: ["GLOW", "USDG", "IMPACT POWER POINTS"],
    toFixed: 6,
  },
  GCC: {
    label: "GCC",
    address: addresses.gcc,
    decimals: 18,
    allowedPairs: ["USDG"],
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
  GCC: "0",
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
  gccPrice,
  usdcRewardPool,
  impactPowerPrice,
  gccCirculatingSupply,
  // totalProtocolFeesLast30days,
}: {
  gccCirculatingSupply: string;
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
  gccPrice: string;
  impactPowerPrice: string;
  // totalProtocolFeesLast30days: string;
}) {
  const [estimatedOutputAmount, setEstimatedOutputAmount] = useState<
    typeof defaultTokensEstimate
  >(defaultTokensEstimate);
  const [isTransitionStarted, startTransition] = React.useTransition();
  const [estimateQueueAmount, setEstimateQueueAmount] = useState<number>(0);
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
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
  const [sendToAddress, setSendToAddress] = useState<string>("");
  const [smartBalancingAmounts, setSmartBalancingAmounts] = useState<
    SmartBalancingAmounts & {
      estimatedCostInUSDForEarlyLiquidity: string;
      estimatedCostInUSDForUniswap: string;
      estimatedTotalGasInUSD: string;
    }
  >();

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
    getBalance,
    isReady,
    usdcBalance,
    setUsdcBalanceForSigner,
    usdgBalance,
    setUsdgBalanceForSigner,
    refreshBalances,
    glowBalance,
    gccBalance,
  } = useER20Balances({
    symbol: selectedTokenSell.label as SYMBOLS,
    signer,
  });
  const debouncedEstimate = useDebouncedCallback(async (amountToSell) => {
    try {
      setEstimateQueueAmount((prev) => prev + 1);
      await estimateAmount();
      setEstimateQueueAmount((prev) => prev - 1);
    } catch (error) {
      setEstimateQueueAmount((prev) => prev - 1);
    }
  }, 500);

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

  const { swap, estimateOutputAmount, estimateGasForUniswap } = useSwap({
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
                  onClick: () => {
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
        return {
          label: `BUY`,
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
          label: `BUY`,
          disabled: false,
          callback: () => {
            setIsDialogOpen(true);
          },
        };
      } else {
        return {
          label: `BUY`,
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
        : selectedTokenSend.label === "GCC"
        ? gccBalance
          ? ethers.utils.formatUnits(gccBalance, selectedTokenSend.decimals)
          : "0"
        : selectedTokenSend.label === "USDG"
        ? usdgBalance
          ? ethers.utils.formatUnits(usdgBalance, selectedTokenSend.decimals)
          : "0"
        : "0"
    );
  };

  const getSendButtonProps = () => {
    console.log({
      amountToSendN: Number(amountToSend),
      sendToAddress,
      getTokenToSendBalance: getTokenToSendBalance(),
    });
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
      Number(amountToSend) > Number(toFixedTruncate(getTokenToSendBalance(), 2))
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
          estimatedGasForswapUSDCToUSDG = estimatedGasForswapUSDCToUSDGRes.val;
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
        2
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
        toast.error(uniswapEstimate.val);
        return;
      }

      if (!findAmountGlowFromUSDGAmountRes.ok) {
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

      const maxOutput = Math.max(
        estimatedUniswapOutputAmount,
        estimatedOutputAmountFormated
      );

      setEstimatedOutputAmount({
        ...defaultTokensEstimate,
        [selectedTokenBuy.label]: maxOutput.toString(),
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
      //@ts-ignore
      selectedTokenBuy.label === "IMPACT POWER POINTS" &&
      (selectedTokenSell.label === "USDG" || selectedTokenSell.label === "USDC")
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
  };

  const getTokenSellBalance = async () => {
    const balance = await getBalance();
    await refreshBalances();
    if (balance.ok) {
      setTokenSellBalance(
        ethers.utils.formatUnits(balance.val, selectedTokenSell.decimals)
      );
    }
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

  const isEstimateLoading =
    estimateQueueAmount !== 0 && amountToSell ? true : false;

  return (
    <div
      id="organization"
      className="container relative flex-col items-center justify-center lg:max-w-none p-0 bg-[#FFFEFA] py-8 md:py-0"
    >
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
            if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
              getTokenSellBalance();
            }
          }
        }}
        slippagePointsTenThousandths={BigNumber.from(
          Number(slippageTolerance) * 100
        )}
      />
      <div className="lg:p-8 flex items-center min-h-screen mx-auto container">
        <div className="flex w-full h-full flex-col justify-center space-y-6 ">
          {isConnecting || isReconnecting ? (
            <Loader2 className="w-[100px] h-[100px] mx-auto animate-spin text-secondary" />
          ) : (
            <div className="!mt-24  grid md:grid-cols-2 md:px-8 gap-8">
              <div className="font-mono md:px-4 md:p-0">
                <h1 className=" text-center md:text-left text-4xl md:text-6xl font-bold mb-8 uppercase ">
                  Glow Token App
                </h1>
                <div className="border border-[E2E2E2] bg-[#FFFFFF] p-4">
                  <h1 className="font-mono text-3xl font-bold mb-3">
                    Glow Stats
                  </h1>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Glow Market Cap
                      </h3>
                    </div>

                    <p className=" font-sans text-right text-2xl">{`$${toFixedTruncate(
                      Number(marketCap),
                      0,
                      true
                    )}`}</p>
                  </div>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        USDC Reward Pool
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`$${parseInt(
                      usdcRewardPool
                    ).toLocaleString()}`}</p>
                  </div>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Glow Price
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`$${toFixedTruncate(
                      Number(glowPrice),
                      2
                    )}`}</p>
                  </div>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Carbon Credit Price
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`$${parseInt(
                      gccPrice
                    ).toLocaleString()}`}</p>
                  </div>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Impact Power Price
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`$${parseInt(
                      impactPowerPrice
                    ).toLocaleString()}`}</p>
                  </div>
                  <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Carbon Credit Supply
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`${Math.round(
                      Number(gccCirculatingSupply)
                    )}`}</p>
                  </div>
                  {/* <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Active solar farms
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`${currentWeekActiveFarms}`}</p>
                  </div> */}
                  {/* <div className="flex justify-between w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-secondary text-xl md:text-2xl md:mb-2">
                        Protocol Fees Paid (30 days)
                      </h3>
                    </div>

                    <p className="font-sans text-right text-2xl">{`$${parseInt(
                      totalProtocolFeesLast30days
                    ).toLocaleString()}`}</p>
                  </div> */}
                </div>
              </div>

              <div className="grid gap-4 md:gap-6 px-4 py-10 md:py-4 md:px-8 z-10 sm:max-w-[600px] bg-white border border-[#E2E2E2] mx-auto">
                <Tabs defaultValue="buy">
                  <TabsList className="text-xl font-mono capitalize text-secondary font-light mb-10">
                    <TabsTrigger
                      value="buy"
                      className="text-xl text-secondary font-mono font-semibold uppercase"
                    >
                      Buy
                    </TabsTrigger>
                    <TabsTrigger
                      value="send"
                      className="text-xl text-secondary font-mono font-semibold uppercase"
                    >
                      Send
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="buy">
                    {/* TOKEN TO SELL  */}
                    <div className="grid border border-[#E2E2E2] gap-2 md:gap-4 my-4">
                      <div className=" p-6 py-4 w-full">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[#0000095] text-lg">You Pay</h3>
                          {isConnected ? (
                            <span className="text-secondary text-sm">
                              Balance :{" "}
                              {toFixedTruncate(Number(tokenSellBalance), 2)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center">
                          {/* handle negative value */}
                          <Input
                            type="text"
                            placeholder="0"
                            className="px-0 text-xl md:text-4xl text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            pattern="[0-9]*"
                            value={amountToSell}
                            disabled={!isConnected}
                            onChange={(e) => {
                              if (Number(e.target.value) < 0) {
                                setAmountToSell("0");
                                return;
                              }
                              setAmountToSell(e.target.value);
                            }}
                          />
                          <Select
                            disabled={!isConnected}
                            value={selectedTokenSell.label}
                            onValueChange={handleSelectTokenToSell}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder="USDG" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USDC">USDC</SelectItem>
                              <SelectItem value="GLOW">GLOW</SelectItem>
                              <SelectItem value="GCC">GCC</SelectItem>
                              <SelectItem value="USDG">USDG</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {/* END TOKEN TO SELL  */}

                    {/* TOKEN TO BUY  */}
                    <div className="grid border border-[#E2E2E2] gap-2">
                      <div className=" p-6 py-4 w-full">
                        <h3 className="text-[#0000095] text-lg">You Receive</h3>
                        <div className="flex items-center">
                          {isEstimateLoading ? (
                            <Skeleton className="w-[50px] md:w-[200px] h-[50px] mr-auto" />
                          ) : (
                            <Input
                              placeholder="0"
                              className="px-0 text-xl md:text-4xl text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={
                                Number(currentTokenEstimatedOutputAmount)
                                  ? formatPrice(
                                      currentTokenEstimatedOutputAmount,
                                      selectedTokenBuy.toFixed
                                    )
                                  : "0"
                              }
                              disabled={!isConnected}
                              readOnly
                            />
                          )}
                          <Select
                            disabled={!isConnected}
                            value={selectedTokenBuy.label}
                            onValueChange={handleSelectTokenToBuy}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue
                                placeholder="USDG"
                                defaultValue="USDG"
                                className="text-right"
                              />
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
                    </div>
                    {/* END TOKEN TO BUY  */}

                    <div className="my-4">
                      {(smartBalancingAmounts &&
                        selectedTokenBuy.label === "GLOW") ||
                      (isEstimateLoading &&
                        selectedTokenBuy.label === "GLOW") ? (
                        <>
                          <div className=" p-6 py-4 w-full flex flex-col mb-4 space-y-2 border border-[#E2E2E2]">
                            <div className="flex items-center justify-between">
                              <p className="text-secondary font-regular">
                                Uniswap Glow Amount
                              </p>
                              <p className="text-secondary font-regular text-right">
                                {isEstimateLoading ? (
                                  <Skeleton className="w-[50px] h-[20px]" />
                                ) : (
                                  Number(
                                    smartBalancingAmounts?.amount_out_uni
                                  ).toFixed(2)
                                )}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-secondary font-regular">
                                Bonding Curve Glow Amount
                              </p>
                              <p className="text-secondary font-regular text-right">
                                {isEstimateLoading ? (
                                  <Skeleton className="w-[50px] h-[20px]" />
                                ) : (
                                  Number(
                                    smartBalancingAmounts?.amount_out_glow
                                  ).toFixed(2)
                                )}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-secondary font-regular">
                                Estimated Network Fee(s)
                              </p>
                              <p className="text-secondary font-regular text-right">
                                {isEstimateLoading ? (
                                  <Skeleton className="w-[50px] h-[20px]" />
                                ) : smartBalancingAmounts ? (
                                  Number.isNaN(
                                    Number(
                                      smartBalancingAmounts.estimatedTotalGasInUSD
                                    )
                                  ) ? (
                                    "-"
                                  ) : (
                                    "〜$" +
                                    smartBalancingAmounts.estimatedTotalGasInUSD
                                  )
                                ) : (
                                  "0"
                                )}
                              </p>
                            </div>
                            {/* <div className="flex items-center justify-between">
                          <p className="text-secondary font-regular">
                            Max. slippage
                          </p>
                          <AfterLabelInput
                            type="number"
                            placeholder="0"
                            className="px-0 max-w-12 text-xl text-secondary caret-secondary focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={slippageTolerance.toString()}
                            label="%"
                            onChange={(e) => {
                              if (Number(e.target.value) < 0) {
                                setSlippageTolerance("0");
                                return;
                              }
                              // max 50% slippage
                              if (Number(e.target.value) > 50) {
                                setSlippageTolerance("50");
                                return;
                              }
                              setSlippageTolerance(e.target.value);
                            }}
                          />
                        </div> */}
                          </div>
                          {Number(slippageTolerance) === 0 ? (
                            <p className=" text-[#eeb517] text-center">
                              Slippage 0% may result in a failed transaction
                            </p>
                          ) : null}
                        </>
                      ) : null}
                      {isConnected ? (
                        <Button
                          disabled={
                            buttonProps.disabled ||
                            pendingTx ||
                            isEstimateLoading
                          }
                          variant={"default"}
                          onClick={buttonProps.callback}
                          className="w-full text-wrap"
                        >
                          <Loader2
                            className={`w-6 h-6 animate-spin mr-2 ${
                              pendingTx ? "block" : "hidden"
                            }`}
                          />{" "}
                          {buttonProps.label}
                        </Button>
                      ) : (
                        <ConnectButton variant="default" className="w-full" />
                      )}
                    </div>

                    <p className="text-secondary text-md font-light text-center flex flex-col">
                      Glow uses a guarded launch. You can read about the full
                      mechanics
                      <InstructionsDialog>
                        <Button
                          variant={"link"}
                          className="text-secondary !p-0 !m-0 h-auto !text-md capitalize"
                        >
                          here
                        </Button>
                      </InstructionsDialog>
                    </p>
                  </TabsContent>
                  <TabsContent value="send">
                    <div className="grid border border-[#E2E2E2] gap-2 md:gap-4 my-4">
                      <div className=" p-6 py-4 w-full">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[#0000095] text-lg">You Send</h3>
                          {isConnected ? (
                            <span className="text-secondary text-sm">
                              Balance :{" "}
                              {toFixedTruncate(getTokenToSendBalance(), 2)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center">
                          {/* handle negative value */}
                          <Input
                            type="text"
                            placeholder="0"
                            className="px-0 text-xl md:text-4xl text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            pattern="[0-9]*"
                            value={amountToSend}
                            disabled={!isConnected}
                            onChange={(e) => {
                              if (Number(e.target.value) < 0) {
                                setAmountToSend("0");
                                return;
                              }
                              setAmountToSend(e.target.value);
                            }}
                          />
                          <Select
                            disabled={!isConnected}
                            value={selectedTokenSend.label}
                            onValueChange={handleSelectTokenToSend}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder="GLOW" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GLOW">GLOW</SelectItem>
                              <SelectItem value="GCC">GCC</SelectItem>
                              <SelectItem value="USDG">USDG</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="grid border border-[#E2E2E2] gap-2 h-[124px]">
                      <div className=" p-6 py-4 w-full">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[#0000095] text-lg">Send To</h3>
                        </div>
                        <div className="flex items-center">
                          <Input
                            type="text"
                            placeholder="0x..."
                            className=" placeholder:text-gray-500 px-0 text-lg  text-secondary caret-secondary border-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={sendToAddress}
                            disabled={!isConnected}
                            onChange={(e) => {
                              setSendToAddress(e.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="my-4">
                      {isConnected ? (
                        <Button
                          disabled={
                            getSendButtonProps().disabled ||
                            pendingTx ||
                            isEstimateLoading
                          }
                          variant={"default"}
                          onClick={handleSendToken}
                          className="w-full text-wrap"
                        >
                          <Loader2
                            className={`w-6 h-6 animate-spin mr-2 ${
                              pendingTx ? "block" : "hidden"
                            }`}
                          />
                          {getSendButtonProps().label}
                        </Button>
                      ) : (
                        <ConnectButton variant="default" className="w-full" />
                      )}
                    </div>

                    <p className="text-secondary text-md font-light text-center flex flex-col">
                      Glow uses a guarded launch. You can read about the full
                      mechanics
                      <InstructionsDialog>
                        <Button
                          variant={"link"}
                          className="text-secondary !p-0 !m-0 h-auto !text-md capitalize"
                        >
                          here
                        </Button>
                      </InstructionsDialog>
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
