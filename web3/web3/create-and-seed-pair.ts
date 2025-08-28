import {
  parseAbi,
  parseUnits,
  type PublicClient,
  type WalletClient,
} from "viem";
import { getAddresses } from "@glowlabs-org/utils/browser";

const factoryAbi = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address)",
]);

const routerAbi = parseAbi([
  "function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) returns (uint amountA,uint amountB,uint liquidity)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

export interface SeedParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  targetPriceUSDGPerGLW?: number; // p = USDG / GLW
  glwDesired?: number; // GLW units (human)
  slippageBps?: number; // default 50 = 0.5%
}

export async function seedGlowUsdgPairOnSepolia({
  publicClient,
  walletClient,
  targetPriceUSDGPerGLW = 0.635834,
  glwDesired = 10_000,
  slippageBps = 50,
}: SeedParams): Promise<{ pair: `0x${string}`; txHash: `0x${string}` | null }> {
  const envChain = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
  if (envChain !== 11155111)
    throw new Error("This seeding helper is intended for Sepolia (11155111)");

  const SDK = getAddresses(envChain);
  const GLW = SDK.GLW as `0x${string}`; // 18d
  const USDG = SDK.USDG as `0x${string}`; // 6d
  const FACTORY = SDK.UNISWAP_V2_FACTORY as `0x${string}`;
  const ROUTER = SDK.UNISWAP_V2_ROUTER as `0x${string}`;

  const account = (walletClient.account?.address ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

  // 1) Ensure pair exists
  let pair = (await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "getPair",
    args: [GLW, USDG],
  })) as `0x${string}`;
  if (pair === "0x0000000000000000000000000000000000000000") {
    const hash = await walletClient.writeContract({
      chain: walletClient.chain as any,
      account,
      address: FACTORY,
      abi: factoryAbi,
      functionName: "createPair",
      args: [GLW, USDG],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pair = (await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "getPair",
      args: [GLW, USDG],
    })) as `0x${string}`;
  }

  // 2) Choose target price ratio p (USDG per GLW) and scale
  const p = targetPriceUSDGPerGLW;
  const usdgDesired = glwDesired * p; // keep ratio for initial price

  const glwAmount = parseUnits(String(glwDesired), 18);
  const usdgAmount = parseUnits(String(usdgDesired), 6);

  // 3) Approve Router to spend
  const approveIfNeeded = async (token: `0x${string}`, amount: bigint) => {
    const allowance = (await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, ROUTER],
    })) as bigint;
    if (allowance < amount) {
      const hash = await walletClient.writeContract({
        chain: walletClient.chain as any,
        account,
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [ROUTER, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  };
  await approveIfNeeded(GLW, glwAmount);
  await approveIfNeeded(USDG, usdgAmount);

  // 4) Seed liquidity (use small slippage buffer)
  const amountAMin =
    (glwAmount * BigInt(10_000 - slippageBps)) / BigInt(10_000);
  const amountBMin =
    (usdgAmount * BigInt(10_000 - slippageBps)) / BigInt(10_000);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

  const addHash = await walletClient.writeContract({
    chain: walletClient.chain as any,
    account,
    address: ROUTER,
    abi: routerAbi,
    functionName: "addLiquidity",
    args: [
      GLW,
      USDG,
      glwAmount,
      usdgAmount,
      amountAMin,
      amountBMin,
      account,
      deadline,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: addHash });
  return { pair, txHash: addHash };
}
export default seedGlowUsdgPairOnSepolia;
