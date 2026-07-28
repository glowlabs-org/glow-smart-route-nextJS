"use client";

import React from "react";
import { useCallback, useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { useWallets as usePrivyWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import {
  getContract,
  createWalletClient,
  custom,
  encodeFunctionData,
} from "viem";
import { useQueryClient } from "@tanstack/react-query";
import {
  // Not a React hook despite the name — a plain factory that binds claim
  // closures to the wallet client passed in. Aliased so we can build a fresh
  // kernel on demand at click time without tripping rules-of-hooks.
  useRewardsKernel as createRewardsKernel,
  type ClaimPayoutParams,
  type TokenAndAmount,
  RewardsKernelError,
  getAddresses,
  REWARDS_KERNEL_ABI,
} from "@glowlabs-org/utils/browser";
import { MinerPoolAndGCAABI } from "@glowlabs-org/guarded-launch-abis";
import { addresses } from "@/web3/constants/addresses";
import type { ClaimableReward } from "./control-wallets";
import * as Sentry from "@sentry/nextjs";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import {
  DEFAULT_WALLET_CLAIMS_LIMIT,
  buildWalletRewardClaimsIndex,
  fetchWalletRewardClaims,
  walletRewardClaimsQueryKey,
  type WalletRewardClaimsIndex,
} from "@/lib/api/wallet-reward-claims-index";
import {
  INSUFFICIENT_GAS_ERROR_MESSAGE,
  NONCE_TOO_LOW_ERROR_MESSAGE,
  isInsufficientGasError,
  isNonceTooLowError,
} from "@/lib/rpc-error-utils";

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID);

// Chain object used to build the dedicated claim-write wallet client.
const ACTIVE_CHAIN = CHAIN_ID === 1 ? mainnet : sepolia;

// Get SDK addresses for tokens
const SDKAddresses = getAddresses(CHAIN_ID);

// Token addresses mapping
const TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  GLW: SDKAddresses.GLW_UNISWAP as `0x${string}`,
  USDC: SDKAddresses.USDC as `0x${string}`,
  USDG: SDKAddresses.USDG_UNISWAP as `0x${string}`,
};

const POSITIONS_API_BASE =
  process.env.NEXT_PUBLIC_POSITIONS_API_BASE || "http://localhost:42069";

export type ClaimStage = "inflation" | "protocolDeposits";

export type ClaimStageStatus =
  | "pending"
  | "inProgress"
  | "success"
  | "skipped"
  | "error";

export interface ClaimProgressUpdate {
  stage: ClaimStage;
  status: ClaimStageStatus;
  txHash?: string | null;
  message?: string;
}

export interface ClaimWeekRewardsOptions {
  onProgress?: (update: ClaimProgressUpdate) => void;
  suppressWeekSuccessToast?: boolean;
  throwOnUserRejected?: boolean;
}

export interface ProtocolDepositMulticallWeek {
  week: number;
  nonce: bigint;
  v2Proof: `0x${string}`[];
  fromAddress: `0x${string}`;
  onchainAssetsEarned: Array<{
    asset: string;
    assetAddress: `0x${string}`;
    amount: string;
  }>;
}

// Result of claimAllProtocolDepositsInOneTx. `txHash` is the multicall tx
// hash when the wrapper actually broadcasts a claim. `alreadyClaimedWeeks`
// is the subset of `weeklyData` that the kernel reports as already-claimed
// on-chain at the time of the call. Callers should treat both signals as
// "this week is now in the claimed state" and apply their optimistic UI
// update accordingly — that way a retry after a dropped modal still
// reconciles the UI even though the indexer has not caught up yet.
//
// `skippedWeeks` covers weeks the kernel refused to include (not finalized
// on-chain yet, or no on-chain assets on the leaf) and `failureReason` is set
// when the send itself failed. Both exist so a caller can tell "nothing to do"
// and "the wallet could not pay" apart from a genuine defect, instead of
// collapsing every non-tx outcome into one generic error.
export interface ClaimAllProtocolDepositsResult {
  txHash: string | null;
  alreadyClaimedWeeks: number[];
  skippedWeeks: number[];
  failureReason?: string;
}

type ClaimAttemptResult =
  | {
      status: "success";
      txHash: string;
      message?: string;
    }
  | {
      status: "skipped";
      txHash?: string;
      message?: string;
    }
  | {
      status: "error";
      txHash?: string;
      message?: string;
    };

export interface UseRewardsKernelWrapperResult {
  claimWeekRewards: (
    week: number,
    rewards: ClaimableReward[],
    nonce: bigint,
    v1Proof: `0x${string}`[],
    v2Proof: `0x${string}`[],
    fromAddress: `0x${string}`,
    glwWeight?: string,
    onchainAssetsEarned?: Array<{
      asset: string;
      assetAddress: `0x${string}`;
      amount: string;
    }>,
    options?: ClaimWeekRewardsOptions,
  ) => Promise<string | null>;
  claimAllRewards: (
    weeklyData: Array<{
      week: number;
      rewards: ClaimableReward[];
      nonce: bigint;
      v1Proof: `0x${string}`[];
      v2Proof: `0x${string}`[];
      fromAddress: `0x${string}`;
      glwWeight?: string;
      onchainAssetsEarned?: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>;
    }>,
  ) => Promise<string[]>;
  claimAllProtocolDepositsInOneTx: (
    weeklyData: ProtocolDepositMulticallWeek[],
  ) => Promise<ClaimAllProtocolDepositsResult>;
  isClaimingWeek: number | null;
  isClaimingAll: boolean;
  checkIfClaimed: (
    userAddress: `0x${string}`,
    nonce: bigint,
  ) => Promise<boolean>;
  isFinalized: (nonce: bigint) => Promise<boolean>;
  checkIfGlwClaimed: (
    week: number,
    userAddress: `0x${string}`,
  ) => Promise<boolean>;
  checkSmartAccount: () => Promise<boolean>;
}

function asLowerHexAddress(value: `0x${string}`): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

// Sentinel `failureReason` for "the user chose to stop". Callers check this to
// avoid escalating a deliberate cancel into an error dialog.
export const CLAIM_CANCELLED_REASON = "cancelled";

function isUserRejectedMessage(message?: string | null): boolean {
  if (!message) return false;
  return (
    message.includes("User rejected") ||
    /denied transaction signature|request rejected|rejected the request|transaction cancelled/i.test(
      message,
    )
  );
}

// Claim writes go straight to the wallet's EIP-1193 provider. In some mobile
// in-app browsers (notably MetaMask iOS) an eth_sendTransaction can be lost
// with no popup and no rejection, hanging until the provider's internal ~120s
// timeout. Bound every send so the hang becomes a fast, visible, retryable
// error instead of a dialog stuck in "processing".
const SEND_TIMEOUT_MS = 45_000;

class WalletSendTimeoutError extends Error {
  constructor() {
    super("Wallet did not respond. Please tap Confirm again.");
    this.name = "WalletSendTimeoutError";
  }
}

// Thrown when the active wallet's own provider cannot be resolved at click
// time. We surface this rather than silently sending through a not-ready
// client.
class WalletNotReadyError extends Error {
  constructor() {
    super("Wallet not ready. Reconnect and tap Confirm again.");
    this.name = "WalletNotReadyError";
  }
}

function isTransientWalletError(error: unknown): boolean {
  return (
    error instanceof WalletSendTimeoutError ||
    error instanceof WalletNotReadyError
  );
}

function withSendTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new WalletSendTimeoutError()),
      SEND_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export function useRewardsKernelWrapper(): UseRewardsKernelWrapperResult {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [isClaimingWeek, setIsClaimingWeek] = useState<number | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  // Claim writes are routed through the active wallet's OWN EIP-1193 provider,
  // resolved fresh at click time (NOT cached in an effect). Privy's
  // useWallets() array churns its identity on every chain/connection change,
  // so an effect-built client is repeatedly torn down mid-flight on mobile
  // in-app browsers, leaving the send to fall back to a transient/stale
  // client. Resolving on demand removes that race, and (per Privy's own
  // guidance) re-requesting the provider AFTER switchChain ensures it is bound
  // to the active chain. If the active wallet cannot be resolved we throw
  // rather than silently send through a not-ready client.
  const { wallets: privyWallets } = usePrivyWallets();

  const resolveSendWalletClient = useCallback(async (): Promise<
    NonNullable<typeof walletClient>
  > => {
    const account = walletClient?.account?.address;
    if (!account) {
      throw new WalletNotReadyError();
    }
    const active = privyWallets.find(
      (w) => w.address.toLowerCase() === account.toLowerCase(),
    );
    if (!active) {
      throw new WalletNotReadyError();
    }
    // switchChain does not update an already-created provider instance, so
    // switch first and then request a fresh provider pinned to the chain.
    await active.switchChain(CHAIN_ID).catch(() => {});
    const provider = await active.getEthereumProvider();
    return createWalletClient({
      account: account as `0x${string}`,
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    }) as NonNullable<typeof walletClient>;
  }, [walletClient?.account?.address, privyWallets]);

  // Read-only kernel. Reads resolve through the public client; every WRITE is
  // built on demand from resolveSendWalletClient and never falls back to this
  // client.
  const rewardsKernel = createRewardsKernel(
    walletClient || undefined,
    publicClient || undefined,
    CHAIN_ID,
  );

  // MinerPoolAndGCA contract (read-only; does not require a connected wallet)
  const minerPoolReadContract = React.useMemo(() => {
    if (!publicClient) return null;
    return getContract({
      address: addresses.gcaAndMinerPoolContract as `0x${string}`,
      abi: MinerPoolAndGCAABI,
      client: { public: publicClient },
    });
  }, [publicClient]);

  // MinerPoolAndGCA contract used for the pre-write reads + simulate. The
  // actual emission write is sent through an on-demand client built from
  // resolveSendWalletClient (see claimGlwInflation), not this instance.
  const minerPoolWriteContract = React.useMemo(() => {
    if (!publicClient || !walletClient) return null;
    return getContract({
      address: addresses.gcaAndMinerPoolContract as `0x${string}`,
      abi: MinerPoolAndGCAABI,
      client: {
        wallet: walletClient,
        public: publicClient,
      },
    });
  }, [publicClient, walletClient]);

  // `useRewardsKernel` returns a new object per render; keep refs in sync so
  // checker callbacks remain referentially stable for row-level effects.
  const rewardsKernelRef = React.useRef(rewardsKernel);
  const minerPoolReadContractRef = React.useRef(minerPoolReadContract);

  React.useEffect(() => {
    rewardsKernelRef.current = rewardsKernel;
  }, [rewardsKernel]);

  React.useEffect(() => {
    minerPoolReadContractRef.current = minerPoolReadContract;
  }, [minerPoolReadContract]);

  const getWalletClaimIndex = useCallback(
    async (walletAddress: `0x${string}`) => {
      const addressLower = asLowerHexAddress(walletAddress);
      const queryKey = walletRewardClaimsQueryKey(
        addressLower,
        DEFAULT_WALLET_CLAIMS_LIMIT,
      );

      const cached =
        queryClient.getQueryData<
          Awaited<ReturnType<typeof fetchWalletRewardClaims>>
        >(queryKey);
      if (cached) return buildWalletRewardClaimsIndex(cached);

      const claimsResponse = await queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchWalletRewardClaims({
            walletAddress: addressLower,
            limit: DEFAULT_WALLET_CLAIMS_LIMIT,
            baseUrl: POSITIONS_API_BASE,
          }),
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
      });

      return buildWalletRewardClaimsIndex(claimsResponse);
    },
    [queryClient],
  );

  // Helper to build claim parameters from onchain assets earned
  const buildClaimParams = useCallback(
    async (
      onchainAssetsEarned: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      nonce: bigint,
      proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`,
    ): Promise<ClaimPayoutParams> => {
      const tokensAndAmounts: TokenAndAmount[] = [];
      const isGuardedToken: boolean[] = [];
      const toCounterfactual: boolean[] = [];

      // Use onchainAssetsEarned directly to ensure we include ALL tokens,
      // even those with amount "0" (required for merkle proof verification)
      onchainAssetsEarned.forEach((asset) => {
        tokensAndAmounts.push({
          token: asset.assetAddress,
          amount: BigInt(asset.amount),
        });

        // GLW and USDG are guarded tokens
        isGuardedToken.push(asset.asset === "GLW" || asset.asset === "USDG");
        // For now, don't use counterfactual addresses
        toCounterfactual.push(false);
      });

      return {
        nonce,
        proof,
        tokensAndAmounts,
        from: fromAddress,
        to: toAddress,
        isGuardedToken,
        toCounterfactual,
      };
    },
    [],
  );

  // Claim GLW inflation rewards from MinerPoolAndGCA contract
  const claimGlwInflation = useCallback(
    async (
      week: number,
      glwWeight: string,
      v1Proof: `0x${string}`[],
      userAddress: `0x${string}`,
    ): Promise<ClaimAttemptResult> => {
      if (!minerPoolWriteContract) {
        toast.error("Contract not available");
        return { status: "error", message: "Contract not available" };
      }

      const bucketWeek = week + 1;
      const bucketId = BigInt(bucketWeek);
      const captureInflationError = (
        errorToCapture: unknown,
        extra?: Record<string, unknown>,
      ) => {
        if (typeof window === "undefined") return;
        const normalizedError =
          errorToCapture instanceof Error
            ? errorToCapture
            : new Error(
                typeof errorToCapture === "string"
                  ? errorToCapture
                  : "GLW emission rewards claim error",
              );
        Sentry.captureException(normalizedError, {
          tags: {
            claimStage: "inflation",
          },
          extra: {
            requestedWeek: week,
            bucketWeek,
            bucketId: bucketId.toString(),
            userAddress,
            glwWeight,
            proofLength: v1Proof.length,
            proofPreview: v1Proof.slice(0, Math.min(2, v1Proof.length)),
            ...(extra ?? {}),
          },
        });
      };

      try {
        // Check if already claimed
        const bitmap = (await minerPoolWriteContract.read.bucketClaimBitmap([
          bucketId,
          userAddress,
        ])) as bigint;
        const alreadyClaimed =
          (bitmap & (BigInt(1) << BigInt(bucketWeek % 256))) > BigInt(0);

        if (alreadyClaimed) {
          return {
            status: "skipped",
            message: "Emission rewards already claimed",
          };
        }

        // Check if bucket is finalized
        const isFinalized = await minerPoolWriteContract.read.isBucketFinalized(
          [bucketId],
        );
        if (!isFinalized) {
          toast.error(`Week ${week} not yet finalized for GLW claims`);
          return {
            status: "error",
            message: "GLW rewards not yet finalized",
          };
        }

        // Simulate to detect reverts before submitting the transaction
        try {
          await minerPoolWriteContract.simulate.claimRewardFromBucket(
            [
              bucketId,
              BigInt(glwWeight),
              BigInt(0), // usdcWeight is always 0 for v2
              v1Proof,
              BigInt(0), // index is always 0 for current reports
              userAddress,
              true, // claimFromInflation
              "0x", // no delegation signature
            ],
            { account: userAddress },
          );
        } catch (simError: any) {
          const simMessage =
            simError?.message ||
            simError?.shortMessage ||
            simError?.cause?.shortMessage ||
            "";

          if (simMessage.includes("UserAlreadyClaimed")) {
            return {
              status: "skipped",
              message: "Emission rewards already claimed",
            };
          } else if (simMessage.includes("BucketNotFinalized")) {
            toast.error("GLW rewards not yet finalized");
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: "GLW rewards not yet finalized",
            };
          } else if (simMessage.includes("InvalidProof")) {
            toast.error("Invalid proof for GLW claim");
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: "Invalid proof for GLW claim",
            };
          } else if (isUserRejectedMessage(simMessage)) {
            toast.info("Transaction cancelled");
            return { status: "error", message: "Transaction cancelled" };
          } else {
            toast.error("Failed to simulate GLW emission rewards claim", {
              description: simMessage || "Unknown error",
            });
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: simMessage || "Failed to simulate GLW claim",
            };
          }
        }

        // Send through the active wallet's own provider, resolved fresh at
        // click time, and bound by a timeout so a lost mobile send fails fast.
        const sendClient = await resolveSendWalletClient();
        const sendContract = getContract({
          address: addresses.gcaAndMinerPoolContract as `0x${string}`,
          abi: MinerPoolAndGCAABI,
          client: sendClient,
        });
        // Execute claim (bucketId, glwWeight, usdcWeight, proof, index, user, claimFromInflation, signature)
        const txHash = await withSendTimeout(
          sendContract.write.claimRewardFromBucket([
            bucketId,
            BigInt(glwWeight),
            BigInt(0), // usdcWeight is always 0 for v2
            v1Proof,
            BigInt(0), // index is always 0 for current reports
            userAddress,
            true, // claimFromInflation
            "0x", // no delegation signature
          ]),
        );

        return {
          status: "success",
          txHash,
          message: "Emission rewards claimed",
        };
      } catch (error: any) {
        console.error("GLW emission rewards claim error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          "Unknown error";

        // Wallet-not-ready / send-timeout are transient, not code bugs: show a
        // retry toast and skip Sentry so the dialog resets cleanly.
        if (isTransientWalletError(error)) {
          toast.error(error.message);
          return { status: "error", message: error.message };
        }

        if (errorMessage.includes("UserAlreadyClaimed")) {
          return {
            status: "skipped",
            message: "Emission rewards already claimed",
          };
        } else if (errorMessage.includes("BucketNotFinalized")) {
          toast.error("GLW rewards not yet finalized");
          captureInflationError(error, {
            phase: "write",
            errorMessage,
          });
          return {
            status: "error",
            message: "GLW rewards not yet finalized",
          };
        } else if (errorMessage.includes("InvalidProof")) {
          toast.error("Invalid proof for GLW claim");
          captureInflationError(error, {
            phase: "write",
            errorMessage,
          });
          return {
            status: "error",
            message: "Invalid proof for GLW claim",
          };
        } else if (isUserRejectedMessage(errorMessage)) {
          toast.info("Transaction cancelled");
          return { status: "error", message: "Transaction cancelled" };
        } else if (isInsufficientGasError(error)) {
          toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
          return {
            status: "error",
            message: INSUFFICIENT_GAS_ERROR_MESSAGE,
          };
        } else if (isNonceTooLowError(error)) {
          toast.error(NONCE_TOO_LOW_ERROR_MESSAGE);
          return {
            status: "error",
            message: NONCE_TOO_LOW_ERROR_MESSAGE,
          };
        }

        toast.error("Failed to claim GLW emission rewards", {
          description: errorMessage,
        });
        captureInflationError(error, {
          phase: "write",
          errorMessage,
        });

        return {
          status: "error",
          message: errorMessage,
        };
      }
    },
    [minerPoolWriteContract, resolveSendWalletClient],
  );

  // Claim protocol deposit rewards from RewardsKernel contract
  const claimProtocolDeposits = useCallback(
    async (
      week: number,
      onchainAssetsEarned: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      nonce: bigint,
      v2Proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`,
    ): Promise<ClaimAttemptResult> => {
      if (onchainAssetsEarned.length === 0) {
        return {
          status: "skipped",
          message: "No protocol deposit rewards available",
        };
      }

      try {
        // Check if already claimed
        const isClaimed = await rewardsKernel.isClaimed(toAddress, nonce);
        if (isClaimed) {
          return {
            status: "skipped",
            message: "Protocol deposit rewards already claimed",
          };
        }

        // Check if finalized
        const finalized = await rewardsKernel.isFinalized(nonce);
        if (!finalized) {
          toast.error(`Week ${week} protocol deposits not yet finalized`);
          return {
            status: "error",
            message: "Protocol deposits not yet finalized",
          };
        }

        // Build claim parameters from onchain assets
        const claimParams = await buildClaimParams(
          onchainAssetsEarned,
          nonce,
          v2Proof,
          fromAddress,
          toAddress,
        );

        // Execute claim through the active wallet's own provider (resolved
        // fresh at click time), bound by a timeout so a lost mobile send
        // fails fast instead of hanging the dialog.
        const sendClient = await resolveSendWalletClient();
        const sendKernel = createRewardsKernel(
          sendClient,
          publicClient || undefined,
          CHAIN_ID,
        );
        const txHash = await withSendTimeout(
          sendKernel.claimPayout(claimParams),
        );
        return {
          status: "success",
          txHash,
          message: "Protocol deposit rewards claimed",
        };
      } catch (error: any) {
        console.error("Protocol deposit claim error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          error?.cause?.message ||
          "Unknown error";

        if (isTransientWalletError(error)) {
          toast.error(error.message);
          return { status: "error", message: error.message };
        }

        if (errorMessage.includes(RewardsKernelError.ALREADY_CLAIMED)) {
          return {
            status: "skipped",
            message: "Protocol deposit rewards already claimed",
          };
        } else if (errorMessage.includes(RewardsKernelError.NOT_FINALIZED)) {
          toast.error("Protocol deposits not yet finalized");
          return {
            status: "error",
            message: "Protocol deposits not yet finalized",
          };
        } else if (errorMessage.includes(RewardsKernelError.NONCE_REJECTED)) {
          toast.error("This reward distribution was rejected");
          return {
            status: "error",
            message: "This reward distribution was rejected",
          };
        } else if (isUserRejectedMessage(errorMessage)) {
          toast.info("Transaction cancelled");
          return { status: "error", message: "Transaction cancelled" };
        } else if (/device disconnected during action/i.test(errorMessage)) {
          toast.error("Wallet disconnected", {
            description: "Reconnect your wallet/device and try again.",
          });
          return {
            status: "error",
            message: "Wallet disconnected. Please reconnect and try again.",
          };
        } else if (isInsufficientGasError(error)) {
          toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
          return {
            status: "error",
            message: INSUFFICIENT_GAS_ERROR_MESSAGE,
          };
        } else if (isNonceTooLowError(error)) {
          toast.error(NONCE_TOO_LOW_ERROR_MESSAGE);
          return {
            status: "error",
            message: NONCE_TOO_LOW_ERROR_MESSAGE,
          };
        }

        toast.error("Failed to claim protocol deposits", {
          description: errorMessage,
        });

        return {
          status: "error",
          message: errorMessage,
        };
      }
    },
    [rewardsKernel, buildClaimParams, resolveSendWalletClient, publicClient],
  );

  // Claim rewards for a specific week (handles both GLW inflation and protocol deposits)
  const claimWeekRewards = useCallback(
    async (
      week: number,
      rewards: ClaimableReward[],
      nonce: bigint,
      v1Proof: `0x${string}`[],
      v2Proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      glwWeight?: string,
      onchainAssetsEarned?: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      options?: ClaimWeekRewardsOptions,
    ): Promise<string | null> => {
      const notifyProgress = (update: ClaimProgressUpdate) =>
        options?.onProgress?.(update);

      if (!walletClient?.account?.address) {
        // wagmi/Privy can desync: useAccount() reports connected (so the
        // claim button is enabled) while useWalletClient() returns null.
        // Without this notification the dialog would stay on its initial
        // "pending" stages and the parent's success branch would paint a
        // misleading green checkmark over a claim that never happened.
        toast.error("Please connect your wallet");
        const walletNotReadyMessage =
          "Wallet not ready — please reconnect and retry";
        if (rewards.some((r) => r.type === "glowInflation")) {
          notifyProgress({
            stage: "inflation",
            status: "error",
            message: walletNotReadyMessage,
          });
        }
        if (rewards.some((r) => r.type === "protocolDeposit")) {
          notifyProgress({
            stage: "protocolDeposits",
            status: "error",
            message: walletNotReadyMessage,
          });
        }
        return null;
      }

      setIsClaimingWeek(week);

      try {
        const userAddress = walletClient.account.address as `0x${string}`;
        const txHashes: string[] = [];
        let encounteredError = false;

        // Separate GLW inflation from protocol deposits
        const glwInflationRewards = rewards.filter(
          (r) => r.type === "glowInflation",
        );
        const hasProtocolDepositRewards = rewards.some(
          (r) => r.type === "protocolDeposit",
        );

        // Claim GLW inflation if present
        if (glwInflationRewards.length > 0) {
          if (!glwWeight) {
            encounteredError = true;
            notifyProgress({
              stage: "inflation",
              status: "error",
              message: "Missing GLW weight for emission rewards claim",
            });
          } else {
            notifyProgress({
              stage: "inflation",
              status: "inProgress",
            });

            const glwResult = await claimGlwInflation(
              week,
              glwWeight,
              v1Proof,
              userAddress,
            );

            if (glwResult.status === "success" && glwResult.txHash) {
              notifyProgress({
                stage: "inflation",
                status: "inProgress",
                txHash: glwResult.txHash,
                message: "Waiting for confirmation",
              });
              try {
                await publicClient?.waitForTransactionReceipt({
                  hash: glwResult.txHash as `0x${string}`,
                  confirmations: 1,
                });
              } catch (error) {
                console.error("Error waiting for GLW receipt:", error);
              }
              notifyProgress({
                stage: "inflation",
                status: "success",
                txHash: glwResult.txHash,
                message: "Transaction confirmed",
              });
              txHashes.push(glwResult.txHash);
            } else if (glwResult.status === "error") {
              if (
                options?.throwOnUserRejected &&
                isUserRejectedMessage(glwResult.message)
              ) {
                const rejectedError = new Error(
                  glwResult.message || "Transaction cancelled",
                ) as Error & { code?: number; name: string };
                rejectedError.code = 4001;
                rejectedError.name = "UserRejectedRequestError";
                throw rejectedError;
              }
              encounteredError = true;
              notifyProgress({
                stage: "inflation",
                status: "error",
                message: glwResult.message,
              });
            } else {
              notifyProgress({
                stage: "inflation",
                status: "skipped",
                message: glwResult.message ?? "No emission rewards this week",
              });
            }
          }
        } else {
          notifyProgress({
            stage: "inflation",
            status: "skipped",
            message: "No emission rewards this week",
          });
        }

        // Claim protocol deposits if present
        // Use onchainAssetsEarned from merkle proof if provided, otherwise skip
        if (hasProtocolDepositRewards && onchainAssetsEarned) {
          notifyProgress({
            stage: "protocolDeposits",
            status: "inProgress",
          });

          const pdResult = await claimProtocolDeposits(
            week,
            onchainAssetsEarned,
            nonce,
            v2Proof,
            fromAddress,
            userAddress,
          );

          if (pdResult.status === "success" && pdResult.txHash) {
            notifyProgress({
              stage: "protocolDeposits",
              status: "inProgress",
              txHash: pdResult.txHash,
              message: "Waiting for confirmation",
            });
            try {
              await publicClient?.waitForTransactionReceipt({
                hash: pdResult.txHash as `0x${string}`,
                confirmations: 1,
              });
            } catch (error) {
              console.error("Error waiting for PD receipt:", error);
            }
            notifyProgress({
              stage: "protocolDeposits",
              status: "success",
              txHash: pdResult.txHash,
              message: "Transaction confirmed",
            });
            txHashes.push(pdResult.txHash);
          } else if (pdResult.status === "error") {
            if (
              options?.throwOnUserRejected &&
              isUserRejectedMessage(pdResult.message)
            ) {
              const rejectedError = new Error(
                pdResult.message || "Transaction cancelled",
              ) as Error & { code?: number; name: string };
              rejectedError.code = 4001;
              rejectedError.name = "UserRejectedRequestError";
              throw rejectedError;
            }
            encounteredError = true;
            notifyProgress({
              stage: "protocolDeposits",
              status: "error",
              message: pdResult.message,
            });
          } else {
            notifyProgress({
              stage: "protocolDeposits",
              status: "skipped",
              message:
                pdResult.message ?? "Protocol deposit rewards already claimed",
            });
          }
        } else {
          notifyProgress({
            stage: "protocolDeposits",
            status: "skipped",
            message: "Protocol deposit rewards already claimed",
          });
        }

        if (txHashes.length > 0) {
          if (!options?.suppressWeekSuccessToast) {
            toast.success(`Successfully claimed week ${week} rewards`, {
              description: `${txHashes.length} transaction(s) completed`,
            });
          }
          return txHashes[0]; // Return first tx hash for compatibility
        }

        if (!encounteredError && !options?.suppressWeekSuccessToast) {
          toast.info(`Week ${week} rewards already claimed or unavailable`);
        }

        return null;
      } catch (error: any) {
        console.error("Claim error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          error?.cause?.message ||
          "Unknown error";
        const isUserRejected =
          error?.code === 4001 ||
          error?.name === "UserRejectedRequestError" ||
          isUserRejectedMessage(errorMessage);

        if (isUserRejected) {
          if (options?.throwOnUserRejected) {
            throw error;
          }
          toast.info("Transaction cancelled");
          return null;
        }

        toast.error("Failed to claim rewards", {
          description: errorMessage,
        });
        return null;
      } finally {
        setIsClaimingWeek(null);
      }
    },
    [walletClient, publicClient, claimGlwInflation, claimProtocolDeposits],
  );

  // Claim all available rewards
  const claimAllRewards = useCallback(
    async (
      weeklyData: Array<{
        week: number;
        rewards: ClaimableReward[];
        nonce: bigint;
        v1Proof: `0x${string}`[];
        v2Proof: `0x${string}`[];
        fromAddress: `0x${string}`;
        glwWeight?: string;
        onchainAssetsEarned?: Array<{
          asset: string;
          assetAddress: `0x${string}`;
          amount: string;
        }>;
      }>,
    ): Promise<string[]> => {
      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return [];
      }

      setIsClaimingAll(true);
      const successfulClaims: string[] = [];
      const failedWeeks: number[] = [];

      try {
        // Process each week sequentially
        for (const weekData of weeklyData) {
          try {
            const txHash = await claimWeekRewards(
              weekData.week,
              weekData.rewards,
              weekData.nonce,
              weekData.v1Proof,
              weekData.v2Proof,
              weekData.fromAddress,
              weekData.glwWeight,
              weekData.onchainAssetsEarned,
            );

            if (txHash) {
              successfulClaims.push(txHash);
            } else {
              failedWeeks.push(weekData.week);
            }
          } catch (error) {
            console.error(`Failed to claim week ${weekData.week}:`, error);
            failedWeeks.push(weekData.week);
          }
        }

        // Show summary
        if (successfulClaims.length > 0 && failedWeeks.length === 0) {
          toast.success(
            `Successfully claimed rewards from ${successfulClaims.length} weeks`,
          );
        } else if (successfulClaims.length > 0 && failedWeeks.length > 0) {
          toast.warning(
            `Claimed ${successfulClaims.length} weeks, ${failedWeeks.length} failed`,
            {
              description: `Failed weeks: ${failedWeeks.join(", ")}`,
            },
          );
        } else {
          toast.error("Failed to claim any rewards");
        }

        return successfulClaims;
      } finally {
        setIsClaimingAll(false);
      }
    },
    [walletClient, claimWeekRewards],
  );

  const claimAllProtocolDepositsInOneTx = useCallback(
    async (
      weeklyData: ProtocolDepositMulticallWeek[],
    ): Promise<ClaimAllProtocolDepositsResult> => {
      const failed = (
        failureReason: string,
      ): ClaimAllProtocolDepositsResult => ({
        txHash: null,
        alreadyClaimedWeeks: [],
        skippedWeeks: [],
        failureReason,
      });

      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return failed("Wallet not connected");
      }

      if (!weeklyData.length) {
        toast.info("No protocol deposit rewards available to claim");
        return { txHash: null, alreadyClaimedWeeks: [], skippedWeeks: [] };
      }

      setIsClaimingAll(true);

      try {
        const userAddress = walletClient.account.address as `0x${string}`;
        const claims: ClaimPayoutParams[] = [];
        const claimWeeks: number[] = [];
        const alreadyClaimedWeeks: number[] = [];
        const skippedWeeks: number[] = [];

        for (const weekData of weeklyData) {
          if (!weekData.onchainAssetsEarned.length) {
            skippedWeeks.push(weekData.week);
            continue;
          }

          const alreadyClaimed = await rewardsKernel.isClaimed(
            userAddress,
            weekData.nonce,
          );
          if (alreadyClaimed) {
            alreadyClaimedWeeks.push(weekData.week);
            continue;
          }

          const finalized = await rewardsKernel.isFinalized(weekData.nonce);
          if (!finalized) {
            skippedWeeks.push(weekData.week);
            continue;
          }

          const claimParams = await buildClaimParams(
            weekData.onchainAssetsEarned,
            weekData.nonce,
            weekData.v2Proof,
            weekData.fromAddress,
            userAddress,
          );
          claims.push(claimParams);
          claimWeeks.push(weekData.week);
        }

        if (!claims.length) {
          // Common case after a tx that actually succeeded but the indexer
          // has not picked it up yet: the kernel says all weeks are already
          // claimed. Report them so the caller can mark them as claimed
          // optimistically instead of leaving the UI in the "ready to claim"
          // state that produced the retry.
          if (alreadyClaimedWeeks.length > 0) {
            toast.info("All protocol deposit rewards are already claimed");
          } else {
            toast.info("No protocol deposit rewards available to claim");
          }
          return { txHash: null, alreadyClaimedWeeks, skippedWeeks };
        }

        // Preflight the gas cost. `simulateContract` is an eth_call and does
        // NOT check the sender's ETH balance, so a wallet with no gas money
        // sails through simulation and only fails at the wallet send — where
        // the provider's "insufficient funds" text used to get flattened away
        // and reported as a generic claim failure. Checking here means the
        // user is told to add ETH before a popup ever opens.
        if (publicClient) {
          try {
            // Mirrors the calldata the SDK builds for the same multicall.
            const callData = claims.map((claim) =>
              encodeFunctionData({
                abi: REWARDS_KERNEL_ABI,
                functionName: "claimPayout",
                args: [
                  claim.nonce,
                  claim.proof as `0x${string}`[],
                  claim.tokensAndAmounts as readonly {
                    token: `0x${string}`;
                    amount: bigint;
                  }[],
                  claim.from as `0x${string}`,
                  claim.to as `0x${string}`,
                  claim.isGuardedToken,
                  claim.toCounterfactual,
                ],
              }),
            );

            const [gasLimit, fees, balance] = await Promise.all([
              publicClient.estimateContractGas({
                address: SDKAddresses.REWARDS_KERNEL as `0x${string}`,
                abi: REWARDS_KERNEL_ABI,
                functionName: "multicall",
                args: [callData],
                account: userAddress,
              }),
              publicClient.estimateFeesPerGas(),
              publicClient.getBalance({ address: userAddress }),
            ]);

            const maxFeePerGas =
              fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
            // 20% headroom: the wallet re-estimates at send time and a fee
            // bump between our read and their popup should not surface as a
            // confusing mid-flow failure.
            const requiredWei = (gasLimit * maxFeePerGas * BigInt(120)) / BigInt(100);

            if (balance < requiredWei) {
              toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
              return failed(INSUFFICIENT_GAS_ERROR_MESSAGE);
            }
          } catch (preflightError) {
            // Never block the claim on a preflight failure — the estimate is
            // advisory. The send path still classifies the real error.
            console.warn(
              "Gas preflight for protocol deposit claim failed; continuing",
              preflightError,
            );
          }
        }

        // Send through the active wallet's own provider (resolved fresh at
        // click time), bound by a timeout so a lost mobile send fails fast.
        const sendClient = await resolveSendWalletClient();
        const sendKernel = createRewardsKernel(
          sendClient,
          publicClient || undefined,
          CHAIN_ID,
        );
        const txHash = await withSendTimeout(
          sendKernel.claimPayoutsMulticall({ claims }),
        );

        try {
          await publicClient?.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
            confirmations: 1,
          });
        } catch (error) {
          console.error("Error waiting for claim-all receipt:", error);
        }

        const skippedAndAlreadyClaimedCount =
          skippedWeeks.length + alreadyClaimedWeeks.length;
        const skippedDescription =
          skippedAndAlreadyClaimedCount > 0
            ? `${skippedAndAlreadyClaimedCount} week(s) were skipped (already claimed or not finalized).`
            : undefined;

        toast.success(
          `Claimed protocol deposits from ${claims.length} week(s) in one transaction`,
          {
            description: skippedDescription,
          },
        );

        return { txHash, alreadyClaimedWeeks, skippedWeeks };
      } catch (error: any) {
        console.error("Claim all protocol deposits error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          error?.cause?.message ||
          "Unknown error";

        if (isTransientWalletError(error)) {
          toast.error(error.message);
          return failed(error.message);
        } else if (isUserRejectedMessage(errorMessage)) {
          toast.info("Transaction cancelled");
          return failed(CLAIM_CANCELLED_REASON);
        } else if (isInsufficientGasError(error)) {
          toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
          return failed(INSUFFICIENT_GAS_ERROR_MESSAGE);
        } else if (isNonceTooLowError(error)) {
          toast.error(NONCE_TOO_LOW_ERROR_MESSAGE);
          return failed(NONCE_TOO_LOW_ERROR_MESSAGE);
        }

        toast.error("Failed to claim all protocol deposits", {
          description: errorMessage,
        });
        return failed(errorMessage);
      } finally {
        setIsClaimingAll(false);
      }
    },
    [
      walletClient,
      rewardsKernel,
      buildClaimParams,
      publicClient,
      resolveSendWalletClient,
    ],
  );

  // Check if rewards have been claimed
  const checkIfClaimed = useCallback(
    async (userAddress: `0x${string}`, nonce: bigint): Promise<boolean> => {
      const addressLower = asLowerHexAddress(userAddress);
      const nonceStr = nonce.toString();

      try {
        const idx = await getWalletClaimIndex(addressLower);
        // Trust the index only for POSITIVES. The positions indexer can report
        // indexingComplete=true while MISSING a claim (false negative) — seen on
        // app.glow.org where an already-claimed nonce showed a phantom "Claim PD"
        // that no-ops and then falsely renders "Claim Complete". When the index
        // says unclaimed, confirm against the chain (authoritative) below.
        if (idx.indexingComplete && idx.claimedV2Nonces.has(nonceStr)) {
          return true;
        }
      } catch (error) {
        console.error("Error checking claim status via API:", error);
      }

      try {
        return await rewardsKernelRef.current.isClaimed(addressLower, nonce);
      } catch (error) {
        console.error("Error checking claim status:", error);
        return false;
      }
    },
    [getWalletClaimIndex],
  );

  // Check if nonce is finalized
  const isFinalized = useCallback(async (nonce: bigint): Promise<boolean> => {
    try {
      return await rewardsKernelRef.current.isFinalized(nonce);
    } catch (error) {
      console.error("Error checking finalization:", error);
      return false;
    }
  }, []);

  // Check if GLW inflation is claimed for a specific week
  const checkIfGlwClaimed = useCallback(
    async (week: number, userAddress: `0x${string}`): Promise<boolean> => {
      const addressLower = asLowerHexAddress(userAddress);
      const bucketWeekStr = BigInt(week).toString();

      try {
        const idx = await getWalletClaimIndex(addressLower);
        if (idx.indexingComplete && idx.hasMinerPoolBucketIds) {
          return idx.claimedV1Buckets.has(bucketWeekStr);
        }
      } catch (error) {
        console.error("Error checking GLW claim status via API:", error);
      }

      const readContract = minerPoolReadContractRef.current;
      if (!readContract) return false;

      try {
        const bucketId = BigInt(week);
        const bitmap = (await readContract.read.bucketClaimBitmap([
          bucketId,
          addressLower,
        ])) as bigint;
        return (bitmap & (BigInt(1) << BigInt(week % 256))) > BigInt(0);
      } catch (error) {
        console.error("Error checking GLW claim status:", error);
        return false;
      }
    },
    [getWalletClaimIndex],
  );

  // Check if the connected wallet is a smart account
  const checkSmartAccount = useCallback(async (): Promise<boolean> => {
    if (!walletClient?.account?.address) {
      return false;
    }

    try {
      const status = await getSmartAccountStatus({
        address: walletClient.account.address,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });

      return (
        status.isEip7702Delegated ||
        status.hasWalletAABatching ||
        status.isContractWallet
      );
    } catch (error) {
      console.error("Error checking smart account status:", error);
      return false;
    }
  }, [walletClient, publicClient]);

  return {
    claimWeekRewards,
    claimAllRewards,
    claimAllProtocolDepositsInOneTx,
    isClaimingWeek,
    isClaimingAll,
    checkIfClaimed,
    isFinalized,
    checkIfGlwClaimed,
    checkSmartAccount,
  };
}
