"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useAccount,
  useConnectorClient,
  useSignTypedData,
  useSwitchChain,
} from "wagmi";
import { type Hex } from "viem";
import { chainIdToName, resolveWalletChainId } from "@/lib/tos-chain";

// ============================================
// EIP-712 Definitions (MUST match the backend
// src/signature-schemas/admin-points-grant.ts)
// ============================================

export const adminPointsGrantEIP712Domain = (chainId: number) =>
  ({
    name: "GlowAdminPointsGrant",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000" as const,
  }) as const;

export const adminPointsGrantEIP712Types = {
  AdminPointsGrant: [
    { name: "recipients", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "reason", type: "string" },
    { name: "idempotencyKey", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ============================================
// Types
// ============================================

export interface GrantRecipientInput {
  /** 0x-prefixed wallet (any casing; normalized before signing). */
  wallet: string;
  /**
   * Amount in scaled6 micros, already parsed and validated by the caller (the
   * dashboard parses with the same `parseUnits(.., 6)` the backend expects, so
   * the submit gate and the signed payload can never diverge).
   */
  amountMicros: bigint;
}

export interface GrantResultRow {
  wallet: string;
  pointsDelta: string;
  ledgerId: string;
  balanceAfter: string;
  alreadyProcessed: boolean;
}

export interface GrantResponse {
  ok: boolean;
  idempotencyKey: string;
  protocolWeek: number;
  grants: GrantResultRow[];
  createdAt: string;
}

// ============================================
// Hook
// ============================================

export function useAdminPointsGrant() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync } = useSwitchChain();
  // The backend verifies against the chain the wallet signed on (sent in the
  // body). We sign with NEXT_PUBLIC_CHAIN_ID so it matches the rest of the app.
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  // Copied from use-referral.ts: mobile in-wallet browsers report a different
  // active chain than wagmi, and their eth_signTypedData_v4 pre-check rejects
  // when domain.chainId != active chain. Resolve and switch first.
  const ensureCorrectChain = React.useCallback(async () => {
    const connector = connectorClient as
      | {
          request?: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        }
      | undefined;
    const provider =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              ethereum?: {
                request?: (args: {
                  method: string;
                  params?: unknown[];
                }) => Promise<unknown>;
              };
            }
          ).ethereum
        : undefined;

    const targetName = chainIdToName(chainId);

    const readChain = () =>
      resolveWalletChainId({
        connectorClient: connector,
        signerProvider: provider?.request
          ? {
              send: (method, params) =>
                provider.request!({ method, params: params ?? [] }),
            }
          : undefined,
      });

    const reported = await readChain();
    if (reported === chainId) return;

    try {
      await switchChainAsync({ chainId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/user rejected|user denied|rejected the request/i.test(message)) {
        throw err;
      }
      throw new Error(
        `Please switch your wallet to ${targetName} and try again.`,
      );
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const confirmed = await readChain();
      if (confirmed === chainId) return;
      await new Promise((r) => setTimeout(r, 250));
    }

    throw new Error(`Please switch your wallet to ${targetName} and try again.`);
  }, [chainId, connectorClient, switchChainAsync]);

  const grantMutation = useMutation({
    mutationFn: async (params: {
      recipients: GrantRecipientInput[];
      reason: string;
      /**
       * Stable per-batch key. The dashboard reuses one key while the batch is
       * unchanged, so a retry after a lost response is a backend no-op rather
       * than a double-grant. Falls back to a fresh UUID if omitted.
       */
      idempotencyKey?: string;
    }): Promise<GrantResponse> => {
      const signer = address;
      if (!signer) throw new Error("Connect an authorized wallet first");
      if (params.recipients.length === 0) {
        throw new Error("Add at least one recipient");
      }

      const recipients = params.recipients.map((r) => r.wallet.toLowerCase());
      const amountsMicros = params.recipients.map((r) => r.amountMicros);
      if (amountsMicros.some((a) => a <= 0n)) {
        throw new Error("Every amount must be greater than zero");
      }

      const idempotencyKey = params.idempotencyKey || crypto.randomUUID();
      const deadline = BigInt(Math.floor(Date.now() / 1000 + 600)); // 10 min

      await ensureCorrectChain();

      const signature = await signTypedDataAsync({
        account: signer,
        domain: adminPointsGrantEIP712Domain(chainId),
        types: adminPointsGrantEIP712Types,
        primaryType: "AdminPointsGrant",
        message: {
          recipients: recipients as Hex[],
          amounts: amountsMicros,
          reason: params.reason,
          idempotencyKey,
          deadline,
        },
      });

      const response = await fetch("/api/internal/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer,
          recipients,
          amounts: amountsMicros.map((a) => a.toString()),
          reason: params.reason,
          idempotencyKey,
          deadline: deadline.toString(),
          signature,
          chainId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (GrantResponse & { error?: string; code?: string })
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ?? `Grant failed (HTTP ${response.status})`,
        );
      }
      return payload;
    },
  });

  return {
    signerAddress: address ?? null,
    isConnected,
    grant: grantMutation.mutateAsync,
    isGranting: grantMutation.isPending,
    grantError: grantMutation.error,
    lastResult: grantMutation.data ?? null,
    reset: grantMutation.reset,
  };
}
