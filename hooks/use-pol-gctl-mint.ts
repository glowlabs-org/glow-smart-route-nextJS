"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  erc20Abi,
  formatUnits,
  parseAbi,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { getAddresses } from "@glowlabs-org/utils/browser";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { normalizeTxHash } from "@/lib/normalize-tx-hash";
import {
  POL_GCTL_ENDOWMENT_WALLET,
  POL_GCTL_LP_TOKEN,
  applyBpsFloor,
  findMintedLpAmount,
  isPolGctlMinterWallet,
  quoteGlwForUsdg,
  type PolGctlMintResult,
  type PolGctlPreview,
} from "@/lib/pol-gctl";

const MAINNET_CHAIN_ID = 1;
const SLIPPAGE_BPS = 100;
const MINT_POLL_INTERVAL_MS = 12_000;
const MINT_POLL_ATTEMPTS = 80;
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ADDRESSES = getAddresses(MAINNET_CHAIN_ID);
const GLW_ADDRESS = ADDRESSES.GLW_UNISWAP as Address;
const USDG_ADDRESS = ADDRESSES.USDG_UNISWAP as Address;
const UNISWAP_ROUTER = ADDRESSES.UNISWAP_V2_ROUTER as Address;
const UNISWAP_FACTORY = ADDRESSES.UNISWAP_V2_FACTORY as Address;

const FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
]);
const PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);
const ROUTER_ABI = parseAbi([
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)",
]);

export type PolGctlPhase =
  | "idle"
  | "switching-chain"
  | "checking-wallet"
  | "approving-glw"
  | "approving-usdg"
  | "adding-liquidity"
  | "donating-lp"
  | "previewing-mint"
  | "waiting-confirmations"
  | "minting-gctl"
  | "complete";

export interface PolGctlProgress {
  phase: PolGctlPhase;
  addLiquidityTxHash: string | null;
  donationTxHash: string | null;
  lpTokensRaw: string | null;
  confirmations: number | null;
  requiredConfirmations: number | null;
  preview: PolGctlPreview | null;
  result: PolGctlMintResult | null;
}

interface PoolState {
  pairAddress: Address;
  glwReserveRaw: bigint;
  usdgReserveRaw: bigint;
}

class PolGctlApiError extends Error {
  status: number;
  code: string | null;
  confirmations: number | null;
  requiredConfirmations: number | null;

  constructor(
    message: string,
    args: {
      status: number;
      code?: string | null;
      confirmations?: number | null;
      requiredConfirmations?: number | null;
    },
  ) {
    super(message);
    this.name = "PolGctlApiError";
    this.status = args.status;
    this.code = args.code ?? null;
    this.confirmations = args.confirmations ?? null;
    this.requiredConfirmations = args.requiredConfirmations ?? null;
  }
}

const INITIAL_PROGRESS: PolGctlProgress = {
  phase: "idle",
  addLiquidityTxHash: null,
  donationTxHash: null,
  lpTokensRaw: null,
  confirmations: null,
  requiredConfirmations: null,
  preview: null,
  result: null,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveUnits(value: string, decimals: number, symbol: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Enter a ${symbol} amount`);
  let parsed: bigint;
  try {
    parsed = parseUnits(trimmed, decimals);
  } catch {
    throw new Error(`${symbol} amount has too many decimals or is invalid`);
  }
  if (parsed <= 0n) throw new Error(`${symbol} amount must be greater than zero`);
  return parsed;
}

async function fetchPoolState(): Promise<PoolState> {
  const pairAddress = await publicClient.readContract({
    address: UNISWAP_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: [GLW_ADDRESS, USDG_ADDRESS],
  });
  if (!pairAddress || pairAddress === zeroAddress) {
    throw new Error("GLW/USDG Uniswap pair was not found");
  }
  if (pairAddress.toLowerCase() !== POL_GCTL_LP_TOKEN.toLowerCase()) {
    throw new Error(
      "Configured GLW/USDG LP token does not match the Uniswap factory",
    );
  }

  const [token0, reserves] = await Promise.all([
    publicClient.readContract({
      address: pairAddress,
      abi: PAIR_ABI,
      functionName: "token0",
    }),
    publicClient.readContract({
      address: pairAddress,
      abi: PAIR_ABI,
      functionName: "getReserves",
    }),
  ]);
  const token0IsGlw = token0.toLowerCase() === GLW_ADDRESS.toLowerCase();
  return {
    pairAddress,
    glwReserveRaw: token0IsGlw ? reserves[0] : reserves[1],
    usdgReserveRaw: token0IsGlw ? reserves[1] : reserves[0],
  };
}

async function postPolGctl<T>(
  action: "preview" | "mint",
  txHash: string,
): Promise<T> {
  const response = await fetch(`/api/internal/pol-gctl/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & {
        error?: string;
        code?: string;
        confirmations?: number;
        requiredConfirmations?: number;
      })
    | null;
  if (!response.ok || !payload) {
    throw new PolGctlApiError(
      payload?.error ?? `POL GCTL request failed (HTTP ${response.status})`,
      {
        status: response.status,
        code: payload?.code,
        confirmations: payload?.confirmations,
        requiredConfirmations: payload?.requiredConfirmations,
      },
    );
  }
  return payload;
}

export function usePolGctlMint() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();
  const [progress, setProgress] =
    React.useState<PolGctlProgress>(INITIAL_PROGRESS);

  const updateProgress = React.useCallback(
    (patch: Partial<PolGctlProgress>) => {
      setProgress((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const poolQuery = useQuery({
    queryKey: ["internal-pol-gctl", "pool"],
    queryFn: fetchPoolState,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const balancesQuery = useQuery({
    queryKey: ["internal-pol-gctl", "balances", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const owner = address as Address;
      const [glw, usdg, lp] = await publicClient.multicall({
        contracts: [
          {
            address: GLW_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          },
          {
            address: USDG_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          },
          {
            address: POL_GCTL_LP_TOKEN,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          },
        ],
        allowFailure: false,
      });
      return {
        glwRaw: glw,
        usdgRaw: usdg,
        lpRaw: lp,
        glw: formatUnits(glw, 18),
        usdg: formatUnits(usdg, 6),
        lp: formatUnits(lp, 18),
      };
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const ensureCorrectWalletAndChain = React.useCallback(async () => {
    if (!address || !walletClient) throw new Error("Connect David's wallet");
    if (!isPolGctlMinterWallet(address)) {
      throw new Error(
        "This tool is restricted to the Foundation miner wallet",
      );
    }
    if (chainId !== MAINNET_CHAIN_ID) {
      updateProgress({ phase: "switching-chain" });
      await switchChainAsync({ chainId: MAINNET_CHAIN_ID });
    }

    updateProgress({ phase: "checking-wallet" });
    const status = await getSmartAccountStatus({
      address,
      chainId: MAINNET_CHAIN_ID,
      walletClient,
      getBytecode: publicClient.getBytecode,
    });
    if (
      status.isEip7702Delegated ||
      status.hasWalletAABatching ||
      status.isContractWallet
    ) {
      throw new Error(
        "Disable Smart Account/EIP-7702 before adding GLW/USDG liquidity",
      );
    }
    return address as Address;
  }, [
    address,
    chainId,
    switchChainAsync,
    updateProgress,
    walletClient,
  ]);

  const ensureAllowance = React.useCallback(
    async (args: {
      token: Address;
      amount: bigint;
      owner: Address;
      phase: "approving-glw" | "approving-usdg";
    }) => {
      if (!walletClient) throw new Error("Wallet client is unavailable");
      const allowance = await publicClient.readContract({
        address: args.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [args.owner, UNISWAP_ROUTER],
      });
      if (allowance >= args.amount) return;

      updateProgress({ phase: args.phase });
      const { request } = await publicClient.simulateContract({
        address: args.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNISWAP_ROUTER, args.amount],
        account: args.owner,
      });
      const hash = normalizeTxHash(await walletClient.writeContract(request));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Token approval reverted");
      }
    },
    [updateProgress, walletClient],
  );

  const submitDonationForMint = React.useCallback(
    async (txHash: string): Promise<PolGctlMintResult> => {
      updateProgress({ phase: "previewing-mint", donationTxHash: txHash });
      const preview = await postPolGctl<PolGctlPreview>("preview", txHash);
      updateProgress({
        preview,
        confirmations: preview.confirmations,
        requiredConfirmations: preview.requiredConfirmations,
        phase: preview.ready ? "minting-gctl" : "waiting-confirmations",
      });

      for (let attempt = 0; attempt < MINT_POLL_ATTEMPTS; attempt += 1) {
        try {
          updateProgress({
            phase:
              attempt === 0 && preview.ready
                ? "minting-gctl"
                : "waiting-confirmations",
          });
          const result = await postPolGctl<PolGctlMintResult>("mint", txHash);
          updateProgress({
            phase: "complete",
            result,
            preview: result,
            confirmations: result.confirmations,
            requiredConfirmations: result.requiredConfirmations,
          });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["internal-pol-gctl", "balances", address],
            }),
            queryClient.invalidateQueries({
              queryKey: ["gctl-balance", address],
            }),
          ]);
          return result;
        } catch (error) {
          if (
            error instanceof PolGctlApiError &&
            error.code === "PENDING_CONFIRMATIONS"
          ) {
            updateProgress({
              phase: "waiting-confirmations",
              confirmations: error.confirmations,
              requiredConfirmations: error.requiredConfirmations,
            });
            await sleep(MINT_POLL_INTERVAL_MS);
            continue;
          }
          throw error;
        }
      }
      throw new Error(
        "The donation is confirmed but GCTL minting timed out. Resume with the donation hash.",
      );
    },
    [address, queryClient, updateProgress],
  );

  const mintMutation = useMutation({
    mutationFn: async (args: { glw: string; usdg: string }) => {
      if (!walletClient) throw new Error("Wallet client is unavailable");
      setProgress(INITIAL_PROGRESS);
      const owner = await ensureCorrectWalletAndChain();
      const glwRaw = parsePositiveUnits(args.glw, 18, "GLW");
      const usdgRaw = parsePositiveUnits(args.usdg, 6, "USDG");
      const balances = await Promise.all([
        publicClient.readContract({
          address: GLW_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
        publicClient.readContract({
          address: USDG_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
      ]);
      if (balances[0] < glwRaw) throw new Error("Insufficient GLW balance");
      if (balances[1] < usdgRaw) throw new Error("Insufficient USDG balance");

      await ensureAllowance({
        token: GLW_ADDRESS,
        amount: glwRaw,
        owner,
        phase: "approving-glw",
      });
      await ensureAllowance({
        token: USDG_ADDRESS,
        amount: usdgRaw,
        owner,
        phase: "approving-usdg",
      });

      updateProgress({ phase: "adding-liquidity" });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      const { request } = await publicClient.simulateContract({
        address: UNISWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: "addLiquidity",
        args: [
          GLW_ADDRESS,
          USDG_ADDRESS,
          glwRaw,
          usdgRaw,
          applyBpsFloor(glwRaw, SLIPPAGE_BPS),
          applyBpsFloor(usdgRaw, SLIPPAGE_BPS),
          owner,
          deadline,
        ],
        account: owner,
      });
      const addLiquidityTxHash = normalizeTxHash(
        await walletClient.writeContract(request),
      );
      updateProgress({ addLiquidityTxHash });
      const addReceipt = await publicClient.waitForTransactionReceipt({
        hash: addLiquidityTxHash,
      });
      if (addReceipt.status !== "success") {
        throw new Error("Uniswap liquidity transaction reverted");
      }
      const lpTokensRaw = findMintedLpAmount({
        logs: addReceipt.logs,
        lpTokenAddress: POL_GCTL_LP_TOKEN,
        recipient: owner,
      });
      if (lpTokensRaw <= 0n) {
        throw new Error("Could not determine the exact LP amount minted");
      }
      updateProgress({ lpTokensRaw: lpTokensRaw.toString() });

      updateProgress({ phase: "donating-lp" });
      const { request: transferRequest } = await publicClient.simulateContract({
        address: POL_GCTL_LP_TOKEN,
        abi: erc20Abi,
        functionName: "transfer",
        args: [POL_GCTL_ENDOWMENT_WALLET, lpTokensRaw],
        account: owner,
      });
      const donationTxHash = normalizeTxHash(
        await walletClient.writeContract(transferRequest),
      );
      updateProgress({ donationTxHash });
      const donationReceipt = await publicClient.waitForTransactionReceipt({
        hash: donationTxHash,
      });
      if (donationReceipt.status !== "success") {
        throw new Error("LP donation transaction reverted");
      }

      return submitDonationForMint(donationTxHash);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (txHash: string) => {
      const normalized = txHash.trim();
      if (!TX_HASH_PATTERN.test(normalized)) {
        throw new Error("Enter a valid Ethereum transaction hash");
      }
      await ensureCorrectWalletAndChain();
      return submitDonationForMint(normalized);
    },
  });

  const suggestedGlwForUsdg = React.useCallback(
    (usdg: string) => {
      const pool = poolQuery.data;
      if (!pool) return "";
      return quoteGlwForUsdg({
        usdg,
        glwReserveRaw: pool.glwReserveRaw,
        usdgReserveRaw: pool.usdgReserveRaw,
      });
    },
    [poolQuery.data],
  );

  const reset = React.useCallback(() => {
    mintMutation.reset();
    resumeMutation.reset();
    setProgress(INITIAL_PROGRESS);
  }, [mintMutation, resumeMutation]);

  return {
    address: address ?? null,
    isConnected,
    isAuthorizedWallet: isPolGctlMinterWallet(address),
    chainId,
    pool: poolQuery.data ?? null,
    isPoolLoading: poolQuery.isLoading,
    poolError: poolQuery.error,
    balances: balancesQuery.data ?? null,
    isBalancesLoading: balancesQuery.isLoading,
    suggestedGlwForUsdg,
    mint: mintMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    isProcessing: mintMutation.isPending || resumeMutation.isPending,
    error: mintMutation.error ?? resumeMutation.error,
    progress,
    reset,
  };
}
