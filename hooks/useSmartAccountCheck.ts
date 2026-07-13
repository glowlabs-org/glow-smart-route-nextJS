"use client";

import * as React from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import {
  getSmartAccountPreflight,
  isSmartAccountPreflightReusable,
  isSmartAccountBlocked,
  SMART_ACCOUNT_UNSUPPORTED_MESSAGE,
  type SmartAccountPreflight,
  type SmartAccountStatus,
} from "@/web3/web3/utils/detectSmartAccount";

export interface UseSmartAccountCheckOptions {
  /** skip the check entirely (eg. dialog not open) */
  enabled?: boolean;
  /** reuse a recent account-and-chain-bound check from the parent flow */
  preflight?: SmartAccountPreflight | null;
}

export interface SmartAccountCheckResult {
  /** true when the wallet is (or has been converted to) a smart account */
  isBlocked: boolean;
  /** while we are probing */
  isChecking: boolean;
  /** human-readable reason for the block, null when not blocked */
  reason: string | null;
  /** raw detection result for debugging */
  status: SmartAccountStatus | null;
  /** reusable account-and-chain-bound result */
  preflight: SmartAccountPreflight | null;
}

/**
 * Detects wallets that have been converted to a smart account (EIP-7702
 * delegation, contract wallet, or wallet-level AA batching) and surfaces a
 * human-readable block reason. Commonly triggered by MetaMask's "pay gas with
 * USDC" feature, which auto-upgrades EOAs into smart accounts and then breaks
 * interactions with contracts that require a plain EOA signer.
 */
export function useSmartAccountCheck(
  options: UseSmartAccountCheckOptions = {},
): SmartAccountCheckResult {
  const { enabled = true, preflight: suppliedPreflight } = options;
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [preflight, setPreflight] =
    React.useState<SmartAccountPreflight | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !address || !publicClient) {
      setPreflight(null);
      setIsChecking(false);
      return;
    }

    if (
      isSmartAccountPreflightReusable({
        preflight: suppliedPreflight,
        address,
        chainId,
      })
    ) {
      setPreflight(suppliedPreflight ?? null);
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    setIsChecking(true);
    (async () => {
      try {
        const next = await getSmartAccountPreflight({
          address,
          chainId,
          walletClient,
          getBytecode: (args) => publicClient.getBytecode(args),
        });
        if (!cancelled) setPreflight(next);
      } catch {
        if (!cancelled) setPreflight(null);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    address,
    chainId,
    publicClient,
    walletClient,
    suppliedPreflight,
  ]);

  return React.useMemo<SmartAccountCheckResult>(() => {
    const status = preflight?.status ?? null;
    const blocked = isSmartAccountBlocked(status);
    return {
      isBlocked: blocked,
      isChecking,
      reason: blocked ? SMART_ACCOUNT_UNSUPPORTED_MESSAGE : null,
      status,
      preflight,
    };
  }, [preflight, isChecking]);
}
