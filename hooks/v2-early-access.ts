"use client";

/**
 * V2 miner early access — signature hook.
 *
 * A wallet that bought the early-access prize may see miner listings up to
 * its entitlement window before public visibility. The sponsor-listings
 * endpoint gates that reveal on a signed EIP-712 payload proving wallet
 * ownership.
 *
 * The launchpad never forces a signature just to load — `unlock()` is
 * called only when an entitled user opts in. The resulting signature is
 * cached at module scope so it survives widget re-mounts within a session
 * and the user signs at most once per ~25 minutes.
 */
import * as React from "react";
import { useAccount, useChainId, useSignTypedData } from "wagmi";

export const earlyAccessEIP712Domain = (chainId: number) =>
  ({
    name: "GlowEarlyAccess",
    version: "1",
    chainId,
    verifyingContract:
      "0x0000000000000000000000000000000000000000" as const,
  }) as const;

export const minerEarlyAccessEIP712Types = {
  MinerEarlyAccess: [
    { name: "wallet", type: "address" },
    { name: "issuedAt", type: "uint256" },
  ],
} as const;

/** Re-sign once the cached payload passes this age (backend rejects at 30 min). */
const SIGNATURE_FRESH_MS = 25 * 60 * 1000;

interface CachedEarlyAccessSig {
  wallet: string;
  chainId: number;
  issuedAt: number;
  signature: string;
}

// Module-level: the signature survives widget re-mounts within a session.
let cachedSig: CachedEarlyAccessSig | null = null;

function freshSigFor(wallet: string | null): CachedEarlyAccessSig | null {
  if (!cachedSig || !wallet) return null;
  if (cachedSig.wallet !== wallet) return null;
  if (Date.now() - cachedSig.issuedAt * 1000 > SIGNATURE_FRESH_MS) return null;
  return cachedSig;
}

export interface UseMinerEarlyAccessSignature {
  /** True once a fresh signature for the connected wallet is cached. */
  isUnlocked: boolean;
  isSigning: boolean;
  /** Base64 payload for the `x-glow-early-access` header, or null. */
  header: string | null;
  /** Prompt the wallet to sign; resolves true on success. */
  unlock: () => Promise<boolean>;
}

export function useMinerEarlyAccessSignature(): UseMinerEarlyAccessSignature {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const [isSigning, setIsSigning] = React.useState(false);
  // Bumped to re-render when the module-level cache changes.
  const [, forceRender] = React.useReducer((n: number): number => n + 1, 0);

  const wallet = address?.toLowerCase() ?? null;
  const valid = freshSigFor(wallet);

  const unlock = React.useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    setIsSigning(true);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signTypedDataAsync({
        account: address as `0x${string}`,
        domain: earlyAccessEIP712Domain(chainId),
        types: minerEarlyAccessEIP712Types,
        primaryType: "MinerEarlyAccess",
        message: {
          wallet: address as `0x${string}`,
          issuedAt: BigInt(issuedAt),
        },
      });
      cachedSig = {
        wallet: address.toLowerCase(),
        chainId,
        issuedAt,
        signature,
      };
      forceRender();
      return true;
    } catch {
      // User rejected the signature, or a wallet error — stay locked.
      return false;
    } finally {
      setIsSigning(false);
    }
  }, [address, chainId, signTypedDataAsync]);

  const header = React.useMemo(() => {
    if (!valid) return null;
    const json = JSON.stringify({
      wallet: valid.wallet,
      issuedAt: valid.issuedAt,
      chainId: valid.chainId,
      signature: valid.signature,
    });
    return typeof window !== "undefined"
      ? window.btoa(json)
      : Buffer.from(json, "utf8").toString("base64");
  }, [valid]);

  return {
    isUnlocked: Boolean(valid),
    isSigning,
    header,
    unlock,
  };
}
