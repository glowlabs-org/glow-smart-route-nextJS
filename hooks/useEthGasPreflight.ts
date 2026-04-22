"use client";

import * as React from "react";
import { useAccount, useBalance, usePublicClient } from "wagmi";

export interface EthGasPreflight {
  /** true when the user has enough ETH; false when short; null while loading */
  sufficient: boolean | null;
  /** wei the user currently holds, null while loading */
  haveWei: bigint | null;
  /** wei the estimated gas will cost at current gas price, null while loading */
  requiredWei: bigint | null;
  /** wei short (0 when sufficient), null while loading */
  shortfallWei: bigint | null;
  /** true while we're fetching balance / gas price */
  isChecking: boolean;
}

export interface UseEthGasPreflightOptions {
  /** estimated gas units for the whole flow (swap + approve, etc.) */
  estimatedGasUnits: bigint;
  /** disable the check entirely (eg. dialog not open) */
  enabled?: boolean;
  /** multiplier to apply to (gasUnits * gasPrice) as a safety margin, default 1.07 (7%) */
  safetyBps?: number;
}

const EMPTY: EthGasPreflight = {
  sufficient: null,
  haveWei: null,
  requiredWei: null,
  shortfallWei: null,
  isChecking: false,
};

/**
 * Pre-flight check that the connected wallet has enough ETH to pay gas for a
 * pending transaction. Use this to gate a submit button before the user hits
 * "confirm" and the RPC rejects the tx with `insufficient funds for gas`.
 *
 * The check reacts to balance changes via `useBalance({ watch: true })`.
 */
export function useEthGasPreflight(
  options: UseEthGasPreflightOptions,
): EthGasPreflight {
  // Default 7% safety margin over (gasUnits * gasPrice). Gas prices move
  // slowly within the few seconds between preflight and submit, so a tighter
  // buffer keeps users from being blocked when they genuinely have enough
  // ETH for the swap.
  const { estimatedGasUnits, enabled = true, safetyBps = 700 } = options;
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: balanceData } = useBalance({
    address,
    query: { enabled: enabled && Boolean(address) },
  });

  const [gasPriceWei, setGasPriceWei] = React.useState<bigint | null>(null);
  const [isFetchingGasPrice, setIsFetchingGasPrice] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !publicClient) {
      setGasPriceWei(null);
      return;
    }
    let cancelled = false;
    setIsFetchingGasPrice(true);
    publicClient
      .getGasPrice()
      .then((price) => {
        if (!cancelled) setGasPriceWei(price);
      })
      .catch(() => {
        if (!cancelled) setGasPriceWei(null);
      })
      .finally(() => {
        if (!cancelled) setIsFetchingGasPrice(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, publicClient]);

  return React.useMemo<EthGasPreflight>(() => {
    if (!enabled) return EMPTY;
    const haveWei = balanceData?.value ?? null;
    const isChecking = isFetchingGasPrice || haveWei === null || gasPriceWei === null;
    if (gasPriceWei === null || haveWei === null) {
      return { ...EMPTY, isChecking };
    }
    const safetyMultiplier = 10_000n + BigInt(safetyBps);
    const requiredWei =
      (estimatedGasUnits * gasPriceWei * safetyMultiplier) / 10_000n;
    const sufficient = haveWei >= requiredWei;
    const shortfallWei = sufficient ? 0n : requiredWei - haveWei;
    return {
      sufficient,
      haveWei,
      requiredWei,
      shortfallWei,
      isChecking: false,
    };
  }, [balanceData?.value, enabled, estimatedGasUnits, gasPriceWei, isFetchingGasPrice, safetyBps]);
}
