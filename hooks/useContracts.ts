import { useEffect, useMemo, useRef } from "react";
import { type UseWalletClientReturnType, useWalletClient } from "wagmi";
import { getAddress, parseAbi, type Address } from "viem";
import { EarlyLiquidityABI, USDGABI } from "@glowlabs-org/guarded-launch-abis";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getAddresses } from "@glowlabs-org/utils/browser";
import {
  addresses,
  addresses as staticAddresses,
} from "@/web3/constants/addresses";
import { normalizeTxHash } from "@/lib/normalize-tx-hash";
import {
  assertWalletClientAccount,
  assertWalletClientForOrder,
  assertWalletClientOnExpectedChain,
  getExpectedChain,
} from "@/lib/wallet-chain";
import type { AssertTransactionActive } from "@/lib/transaction-operation";
import {
  writeContractWithWalletLifecycle,
  type WalletWriteInstrumentation,
} from "@/lib/wallet-request";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

type AnyAddress = `0x${string}`;
type WalletClientFromWagmi = NonNullable<UseWalletClientReturnType["data"]>;

export function useContracts(_signer: any) {
  const { data: walletClient } = useWalletClient();
  const walletClientRef = useRef<WalletClientFromWagmi | null>(null);

  useEffect(() => {
    if (walletClient) walletClientRef.current = walletClient;
  }, [walletClient]);

  const walletClientChainId = walletClient?.chain?.id;
  const walletClientAddress = walletClient?.account?.address;
  const walletClientKey =
    walletClientChainId && walletClientAddress
      ? `${walletClientChainId}:${walletClientAddress}`
      : "";

  const { earlyLiquidity, glow, usdg, usdc } = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
      throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
    }
    const SDKAddresses = getAddresses(
      parseInt(process.env.NEXT_PUBLIC_CHAIN_ID)
    );

    const GLW_ADDRESS: AnyAddress = SDKAddresses?.GLW_UNISWAP as AnyAddress;
    const USDG_ADDRESS: AnyAddress = SDKAddresses?.USDG_UNISWAP as AnyAddress;
    const USDC_ADDRESS: AnyAddress = SDKAddresses?.USDC;
    const EARLY_LIQUIDITY_ADDRESS: AnyAddress = addresses.earlyLiquidity;

    function makeTx(rawHash: unknown) {
      const hash = normalizeTxHash(rawHash);
      return {
        hash,
        wait: async () => publicClient.waitForTransactionReceipt({ hash }),
      } as any;
    }

    function getWalletClientOrThrow(expectedAccount?: Address) {
      const wc = walletClientRef.current;
      if (!wc) throw new Error("Wallet client not available");
      assertWalletClientOnExpectedChain(wc);
      if (expectedAccount) assertWalletClientAccount(wc, expectedAccount);
      return wc;
    }

    function makeSignerLike() {
      return {
        getAddress: async (expectedAccount?: Address) => {
          const wc = getWalletClientOrThrow(expectedAccount);
          await assertWalletClientForOrder(wc, expectedAccount);
          if (!wc.account?.address)
            throw new Error("Wallet client not available");
          return getAddress(wc.account.address) as AnyAddress;
        },
      } as any;
    }

    function makeProviderLike() {
      return {
        getGasPrice: async () => publicClient.getGasPrice(),
      } as any;
    }

    function makeErc20(address: AnyAddress) {
      return {
        address,
        signer: makeSignerLike(),
        provider: makeProviderLike(),
        balanceOf: async (owner: AnyAddress) =>
          (await publicClient.readContract({
            address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          })) as bigint,
        allowance: async (owner: AnyAddress, spender: AnyAddress) =>
          (await publicClient.readContract({
            address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [owner, spender],
          })) as bigint,
        approve: async (
          spender: AnyAddress,
          amount: bigint,
          expectedAccount?: Address,
          assertTransactionActive?: AssertTransactionActive,
          walletRequest?: WalletWriteInstrumentation,
        ) => {
          console.log("approve", spender, amount);
          assertTransactionActive?.();
          const wc = getWalletClientOrThrow(expectedAccount);
          await assertWalletClientForOrder(wc, expectedAccount);
          assertTransactionActive?.();
          const hash = await writeContractWithWalletLifecycle(
            wc,
            {
              address,
              abi: erc20Abi,
              functionName: "approve",
              args: [spender, amount],
              chain: getExpectedChain(),
              account: wc.account,
            },
            walletRequest ?? { action: "approve_erc20" },
          );
          assertTransactionActive?.();
          return makeTx(hash);
        },
        transfer: async (
          to: AnyAddress,
          amount: bigint,
          expectedAccount?: Address,
          assertTransactionActive?: AssertTransactionActive,
          walletRequest?: WalletWriteInstrumentation,
        ) => {
          assertTransactionActive?.();
          const wc = getWalletClientOrThrow(expectedAccount);
          await assertWalletClientForOrder(wc, expectedAccount);
          assertTransactionActive?.();
          const hash = await writeContractWithWalletLifecycle(
            wc,
            {
              address,
              abi: erc20Abi,
              functionName: "transfer",
              args: [to, amount],
              chain: getExpectedChain(),
              account: wc.account,
            },
            walletRequest ?? { action: "transfer_erc20" },
          );
          assertTransactionActive?.();
          return makeTx(hash);
        },
        estimateGas: {
          approve: async (spender: AnyAddress, amount: bigint) =>
            publicClient.estimateContractGas({
              address,
              abi: erc20Abi,
              functionName: "approve",
              account: walletClientRef.current?.account?.address as AnyAddress,
              args: [spender, amount],
            }),
        },
      } as any;
    }

    const earlyLiquidity = {
      address: EARLY_LIQUIDITY_ADDRESS,
      getPrice: async (increments: number) =>
        (await publicClient.readContract({
          address: EARLY_LIQUIDITY_ADDRESS,
          abi: EarlyLiquidityABI,
          functionName: "getPrice",
          args: [BigInt(increments)],
        })) as bigint,
      buy: async (
        increments: number,
        usdgMaxToSpend: bigint,
        expectedAccount?: Address,
        assertTransactionActive?: AssertTransactionActive,
        walletRequest?: WalletWriteInstrumentation,
      ) => {
        assertTransactionActive?.();
        const wc = getWalletClientOrThrow(expectedAccount);
        await assertWalletClientForOrder(wc, expectedAccount);
        assertTransactionActive?.();
        const hash = await writeContractWithWalletLifecycle(
          wc,
          {
            address: EARLY_LIQUIDITY_ADDRESS,
            abi: EarlyLiquidityABI,
            functionName: "buy",
            args: [BigInt(increments), usdgMaxToSpend],
            chain: getExpectedChain(),
            account: wc.account,
          },
          walletRequest ?? { action: "buy_early_liquidity" },
        );
        assertTransactionActive?.();
        return makeTx(hash);
      },
    } as any;

    const glow = makeErc20(GLW_ADDRESS);

    const usdg = {
      ...makeErc20(USDG_ADDRESS),
      swap: async (
        recipient: AnyAddress,
        usdcAmount: bigint,
        expectedAccount?: Address,
        assertTransactionActive?: AssertTransactionActive,
        walletRequest?: WalletWriteInstrumentation,
      ) => {
        assertTransactionActive?.();
        const wc = getWalletClientOrThrow(expectedAccount);
        await assertWalletClientForOrder(wc, expectedAccount);
        assertTransactionActive?.();
        if (
          expectedAccount &&
          getAddress(recipient) !== getAddress(expectedAccount)
        ) {
          throw new Error("USDG recipient does not match this order's wallet.");
        }
        const hash = await writeContractWithWalletLifecycle(
          wc,
          {
            address: USDG_ADDRESS,
            abi: USDGABI,
            functionName: "swap",
            args: [recipient, usdcAmount],
            chain: getExpectedChain(),
            account: wc.account,
          },
          walletRequest ?? { action: "swap_usdc_to_usdg" },
        );
        assertTransactionActive?.();
        return makeTx(hash);
      },
    } as any;

    const usdc = makeErc20(USDC_ADDRESS);

    return { earlyLiquidity, glow, usdg, usdc };
    // The wrappers intentionally read walletClientRef at call time so a
    // transient undefined wagmi value cannot erase an otherwise valid client.
    // Rebuild only when the connected account or chain identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClientKey]);

  return {
    earlyLiquidity,
    glow,
    usdg,
    usdc,
    isReady: Boolean(walletClientKey),
  };
}
