import { useEffect, useMemo, useState } from "react";
import { useWalletClient } from "wagmi";
import { parseAbi, type WalletClient } from "viem";
import { EarlyLiquidityABI, USDGABI } from "@glowlabs-org/guarded-launch-abis";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getAddresses } from "@glowlabs-org/utils/browser";
import {
  addresses,
  addresses as staticAddresses,
} from "@/web3/constants/addresses";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

type AnyAddress = `0x${string}`;

export function useContracts(_signer: any) {
  const { data: walletClient } = useWalletClient();

  const [isReady, setIsReady] = useState(false);

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

    function makeTx(hash: `0x${string}`) {
      return {
        hash,
        wait: async () => publicClient.waitForTransactionReceipt({ hash }),
      } as any;
    }

    function makeSignerLike(wc: WalletClient | undefined | null) {
      return {
        getAddress: async () => {
          if (!wc?.account?.address)
            throw new Error("Wallet client not available");
          return wc.account.address as AnyAddress;
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
        signer: makeSignerLike(walletClient),
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
        approve: async (spender: AnyAddress, amount: bigint) => {
          console.log("approve", spender, amount);
          if (!walletClient) throw new Error("Wallet client not available");
          const hash = await walletClient.writeContract({
            address,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, amount],
          });
          return makeTx(hash);
        },
        transfer: async (to: AnyAddress, amount: bigint) => {
          if (!walletClient) throw new Error("Wallet client not available");
          const hash = await walletClient.writeContract({
            address,
            abi: erc20Abi,
            functionName: "transfer",
            args: [to, amount],
          });
          return makeTx(hash);
        },
        estimateGas: {
          approve: async (spender: AnyAddress, amount: bigint) =>
            publicClient.estimateContractGas({
              address,
              abi: erc20Abi,
              functionName: "approve",
              account: walletClient?.account?.address as AnyAddress,
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
      buy: async (increments: number, usdgMaxToSpend: bigint) => {
        if (!walletClient) throw new Error("Wallet client not available");
        const hash = await walletClient.writeContract({
          address: EARLY_LIQUIDITY_ADDRESS,
          abi: EarlyLiquidityABI,
          functionName: "buy",
          args: [BigInt(increments), usdgMaxToSpend],
        });
        return makeTx(hash);
      },
    } as any;

    const glow = makeErc20(GLW_ADDRESS);

    const usdg = {
      ...makeErc20(USDG_ADDRESS),
      swap: async (recipient: AnyAddress, usdcAmount: bigint) => {
        if (!walletClient) throw new Error("Wallet client not available");
        const hash = await walletClient.writeContract({
          address: USDG_ADDRESS,
          abi: USDGABI,
          functionName: "swap",
          args: [recipient, usdcAmount],
        });
        return makeTx(hash);
      },
    } as any;

    const usdc = makeErc20(USDC_ADDRESS);

    return { earlyLiquidity, glow, usdg, usdc };
  }, [walletClient]);

  useEffect(() => {
    console.log("useContracts - walletClient state:", {
      hasWalletClient: !!walletClient,
      walletClientAccount: walletClient?.account?.address,
      isReady: Boolean(walletClient),
    });
    setIsReady(Boolean(walletClient));
  }, [walletClient]);

  return {
    earlyLiquidity,
    glow,
    usdg,
    usdc,
    isReady,
  };
}
