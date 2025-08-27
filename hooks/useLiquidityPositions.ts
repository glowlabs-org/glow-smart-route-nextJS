"use client";

import * as React from "react";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";

export interface Position {
  id: string;
  pair: "GLW/USDG";
  glwAmount: number;
  usdgAmount: number;
  apy: number;
  poolSharePct: number;
  createdAt: number;
  initialGlw: number;
  initialUsdg: number;
}

interface LiquidityPoolReserves {
  glw: number;
  usdg: number;
}

interface UseLiquidityPositionsOptions {
  initialPositions?: Position[];
  priceRatio?: number; // USDG per 1 GLW
  poolReserves?: LiquidityPoolReserves;
  feeApyPercent?: number;
  epochSeconds?: number;
}

const DEFAULT_PRICE_RATIO = 0.635834;
const DEFAULT_POOL_RESERVES: LiquidityPoolReserves = {
  glw: 13_900_000,
  usdg: 8_800_000,
};
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;

const DEFAULT_POSITIONS: Position[] = [
  {
    id: "p1",
    pair: "GLW/USDG",
    glwAmount: 1200.5,
    usdgAmount: 820.25,
    apy: 12.1,
    poolSharePct: 0.22,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    initialGlw: 1200.5,
    initialUsdg: 820.25,
  },
];

export function useLiquidityPositions(options?: UseLiquidityPositionsOptions) {
  const priceRatio = options?.priceRatio ?? DEFAULT_PRICE_RATIO;
  const poolReserves = options?.poolReserves ?? DEFAULT_POOL_RESERVES;
  const feeApyPercent = options?.feeApyPercent ?? 6; // mock exchange fee APY in percent
  const epochSeconds = options?.epochSeconds ?? 7 * 24 * 60 * 60;

  const [positions, setPositions] = React.useState<Position[]>(
    options?.initialPositions ?? DEFAULT_POSITIONS
  );
  const [now, setNow] = React.useState<number>(Date.now());

  const [rewardsEarnedGlw, setRewardsEarnedGlw] = React.useState<number>(0);
  const animatedRewards = useMotionValue(0);
  const [animatedRewardsDisplay, setAnimatedRewardsDisplay] = React.useState(0);
  const [totalRatePerSec, setTotalRatePerSec] = React.useState(0);
  const [feesRatePerSec, setFeesRatePerSec] = React.useState(0);

  const [positionFinalizedMap, setPositionFinalizedMap] = React.useState<
    Record<string, number>
  >({});
  const [positionPendingMap, setPositionPendingMap] = React.useState<
    Record<string, number>
  >({});
  const [positionRateMap, setPositionRateMap] = React.useState<
    Record<string, number>
  >({});
  const [positionFeesMap, setPositionFeesMap] = React.useState<
    Record<string, number>
  >({});
  const [positionFeeRateMap, setPositionFeeRateMap] = React.useState<
    Record<string, number>
  >({});

  const [showIncentiveDialog, setShowIncentiveDialog] = React.useState(false);

  useMotionValueEvent(animatedRewards, "change", (v) =>
    setAnimatedRewardsDisplay(v)
  );

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    try {
      const dialogAck = window.localStorage.getItem("lp_dialog_ack");
      if (dialogAck !== "1") setShowIncentiveDialog(true);
    } catch {}
  }, []);

  function acknowledgeIncentiveDialog() {
    try {
      window.localStorage.setItem("lp_dialog_ack", "1");
    } catch {}
    setShowIncentiveDialog(false);
  }

  function onIncentiveDialogOpenChange(open: boolean) {
    if (!open) {
      acknowledgeIncentiveDialog();
      return;
    }
    setShowIncentiveDialog(true);
  }

  function getLoyaltyMultiplier(createdAt: number) {
    const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
    return Math.pow(days, 0.176091259) || 0;
  }

  function getRewardsEstimatesGLW(p: Position) {
    const apyPerSecond = p.apy / 100 / (365 * 24 * 60 * 60);
    const elapsedSeconds = Math.max(0, Math.floor((now - p.createdAt) / 1000));
    const multiplier = getLoyaltyMultiplier(p.createdAt);

    const completedEpochs = Math.floor(elapsedSeconds / epochSeconds);
    const finalizedSeconds = completedEpochs * epochSeconds;
    const pendingSeconds = elapsedSeconds - finalizedSeconds;

    const finalized =
      p.glwAmount * apyPerSecond * finalizedSeconds * multiplier;
    const pending = p.glwAmount * apyPerSecond * pendingSeconds * multiplier;
    const ratePerSecond = p.glwAmount * apyPerSecond * multiplier;

    return { finalized, pending, multiplier, ratePerSecond };
  }

  React.useEffect(() => {
    let finalizedSum = 0;
    let totalRate = 0;
    let totalNowAccum = 0;
    const finalizedById: Record<string, number> = {};
    const pendingById: Record<string, number> = {};
    const rateById: Record<string, number> = {};
    const feesById: Record<string, number> = {};
    const feeRateById: Record<string, number> = {};
    let totalFeeRate = 0;

    for (const p of positions) {
      const r = getRewardsEstimatesGLW(p);
      finalizedSum += r.finalized;
      totalRate += r.ratePerSecond;
      totalNowAccum += r.finalized + r.pending;
      finalizedById[p.id] = r.finalized;
      pendingById[p.id] = r.pending;
      rateById[p.id] = r.ratePerSecond;

      const positionValueInUSDG = p.usdgAmount + p.glwAmount * priceRatio;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - p.createdAt) / 1000)
      );
      const feeRatePerSecond =
        ((feeApyPercent / 100) * positionValueInUSDG) / SECONDS_IN_YEAR;
      const feesAccrued = feeRatePerSecond * elapsedSeconds;
      feesById[p.id] = feesAccrued;
      feeRateById[p.id] = feeRatePerSecond;
      totalFeeRate += feeRatePerSecond;
    }

    setRewardsEarnedGlw(finalizedSum);
    setTotalRatePerSec(totalRate);
    setPositionFinalizedMap(finalizedById);
    setPositionPendingMap(pendingById);
    setPositionRateMap(rateById);
    setPositionFeesMap(feesById);
    setPositionFeeRateMap(feeRateById);
    setFeesRatePerSec(totalFeeRate);

    animatedRewards.set(totalNowAccum);
    const tick = setInterval(() => {
      const target = animatedRewards.get() + totalRate;
      animate(animatedRewards, target, { duration: 0.8, ease: "easeOut" });
    }, 1000);
    return () => clearInterval(tick);
  }, [positions, now, priceRatio, feeApyPercent, epochSeconds]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setPositionPendingMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(prev))
          next[key] = prev[key] + (positionRateMap[key] || 0);
        return next;
      });
      setPositionFeesMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(positionFeeRateMap)) {
          const current = prev[key] ?? 0;
          next[key] = current + (positionFeeRateMap[key] || 0);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [positionRateMap, positionFeeRateMap]);

  async function addLiquidity({ glw, usdg }: { glw: number; usdg: number }) {
    const newPos: Position = {
      id: `p${positions.length + 1}`,
      pair: "GLW/USDG",
      glwAmount: glw,
      usdgAmount: usdg,
      apy: 11.1,
      poolSharePct: 0.01,
      createdAt: Date.now(),
      initialGlw: glw,
      initialUsdg: usdg,
    };
    setPositions((prev) => [newPos, ...prev]);
    await Promise.resolve();
  }

  async function removeLiquidity(percentage: number) {
    const sortedPositions = [...positions].sort(
      (a, b) => b.createdAt - a.createdAt
    );
    let remainingPct = percentage;

    const updatedPositions = sortedPositions
      .map((position) => {
        if (remainingPct <= 0) return position;
        const removeRatio = Math.min(remainingPct, 100) / 100;
        const newGlw = position.glwAmount * (1 - removeRatio);
        const newUsdg = position.usdgAmount * (1 - removeRatio);
        remainingPct = 0;
        return {
          ...position,
          glwAmount: Number(newGlw.toFixed(4)),
          usdgAmount: Number(newUsdg.toFixed(2)),
        };
      })
      .filter((p) => p.glwAmount > 0 && p.usdgAmount > 0);

    setPositions(updatedPositions);
    await Promise.resolve();
  }

  return {
    // state
    positions,
    now,
    // rewards
    rewardsEarnedGlw,
    animatedRewardsDisplay,
    totalRatePerSec,
    feesRatePerSec,
    positionFinalizedMap,
    positionPendingMap,
    positionRateMap,
    positionFeesMap,
    positionFeeRateMap,
    // params
    priceRatio,
    poolReserves,
    // helpers
    getLoyaltyMultiplier,
    getRewardsEstimatesGLW,
    // actions
    addLiquidity,
    removeLiquidity,
    // dialogs
    showIncentiveDialog,
    acknowledgeIncentiveDialog,
    onIncentiveDialogOpenChange,
  };
}
