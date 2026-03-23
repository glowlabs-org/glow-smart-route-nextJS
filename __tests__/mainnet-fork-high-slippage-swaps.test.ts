import "dotenv/config";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import {
  computeAmountOutMin,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SLIPPAGE_TOLERANCE,
  HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT,
  slippagePctToBps,
} from "@/lib/swap-slippage";
import { getAmountOut } from "@/utils/uniswapv2/getAmountOut";

/**
 * Run manually (disabled by default):
 * RUN_MAINNET_FORK_TESTS=1 pnpm dlx vitest run __tests__/mainnet-fork-high-slippage-swaps.test.ts
 */

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ?? process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
const SHOULD_RUN_FORK_TEST =
  process.env.RUN_MAINNET_FORK_TESTS === "1" && Boolean(MAINNET_RPC_URL);

const describeFork = SHOULD_RUN_FORK_TEST ? describe : describe.skip;

const TEST_WALLET = "0x66414Ef3a14504BA9B919341255c59eb4bAa6d0C" as Address;
const CHAIN_ID = 1;
const PINNED_FORK_BLOCK = 24_720_329;
const ONE_PERCENT_BPS = 100n;
const FIFTEEN_PERCENT_BPS = slippagePctToBps(DEFAULT_SLIPPAGE_TOLERANCE);
const SEARCH_STEP_GLOW = parseUnits("1000", 18);
const TARGET_SWAP_GLOW = parseUnits("10000", 18);
const UNISWAP_V2_ROUTER =
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as Address;
const UNISWAP_V2_FACTORY =
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" as Address;
const GLOW_ADDRESS = "0xf4fbC617A5733EAAF9af08E1Ab816B103388d8B6" as Address;
const USDG_ADDRESS = "0xe010ec500720bE9EF3F82129E7eD2Ee1FB7955F2" as Address;

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const UNISWAP_V2_FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
]);

const UNISWAP_V2_PAIR_ABI = parseAbi([
  "function token0() external view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external returns (uint256[] amounts)",
]);

type PairReserves = {
  glowReserve: bigint;
  usdgReserve: bigint;
};

describeFork("mainnet fork: high-slippage GLW/USDG swaps", () => {
  const anvilPort = Number(process.env.MAINNET_FORK_TEST_PORT ?? "8548");
  const anvilRpcUrl = `http://127.0.0.1:${anvilPort}`;
  const forkTimeoutMs = Number(process.env.MAINNET_FORK_TIMEOUT_MS ?? "90000");
  const forkBlockNumber = Number(
    process.env.MAINNET_FORK_BLOCK_NUMBER ?? PINNED_FORK_BLOCK
  );

  let anvilProcess: ChildProcessWithoutNullStreams | null = null;
  let publicClient: ReturnType<typeof createPublicClient>;
  let walletClient: ReturnType<typeof createWalletClient>;
  let testClient: ReturnType<typeof createTestClient>;
  let pairAddress: Address;

  async function waitForAnvilReady(timeoutMs: number) {
    const start = Date.now();
    let lastError = "";

    while (Date.now() - start < timeoutMs) {
      try {
        await publicClient.getBlockNumber();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    throw new Error(`Anvil did not become ready. Last error: ${lastError}`);
  }

  async function getGlowUsdgReserves(): Promise<PairReserves> {
    const [token0, reserves] = await Promise.all([
      publicClient.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "token0",
      }),
      publicClient.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "getReserves",
      }),
    ]);

    const [reserve0, reserve1] = reserves as readonly [bigint, bigint, number];
    const isGlowToken0 =
      String(token0).toLowerCase() === GLOW_ADDRESS.toLowerCase();

    return {
      glowReserve: isGlowToken0 ? reserve0 : reserve1,
      usdgReserve: isGlowToken0 ? reserve1 : reserve0,
    };
  }

  async function tokenBalanceOf(
    tokenAddress: Address,
    wallet: Address
  ): Promise<bigint> {
    return (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet],
    })) as bigint;
  }

  async function ensureGlowAllowance(amount: bigint) {
    const allowance = (await publicClient.readContract({
      address: GLOW_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [TEST_WALLET, UNISWAP_V2_ROUTER],
    })) as bigint;

    if (allowance >= amount) return;

    const approveHash = await walletClient.writeContract({
      address: GLOW_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [UNISWAP_V2_ROUTER, 2n ** 256n - 1n],
      account: TEST_WALLET,
      chain: mainnet,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    expect(approveReceipt.status).toBe("success");
  }

  function quoteGlowToUsdg(amountIn: bigint, reserves: PairReserves): bigint {
    const result = getAmountOut({
      amountIn,
      reserveIn: reserves.glowReserve,
      reserveOut: reserves.usdgReserve,
    });
    if (!result.ok) throw new Error(result.val);
    return result.val;
  }

  function findAdverseMoveAmount({
    walletGlowBalance,
    targetAmountIn,
    reserves,
  }: {
    walletGlowBalance: bigint;
    targetAmountIn: bigint;
    reserves: PairReserves;
  }) {
    const originalQuote = quoteGlowToUsdg(targetAmountIn, reserves);
    const onePercentMinOut = computeAmountOutMin(originalQuote, ONE_PERCENT_BPS);
    const fifteenPercentMinOut = computeAmountOutMin(
      originalQuote,
      FIFTEEN_PERCENT_BPS
    );
    const maxMove = walletGlowBalance - targetAmountIn;

    for (
      let moveAmount = SEARCH_STEP_GLOW;
      moveAmount <= maxMove;
      moveAmount += SEARCH_STEP_GLOW
    ) {
      const moveOut = quoteGlowToUsdg(moveAmount, reserves);
      const movedReserves: PairReserves = {
        glowReserve: reserves.glowReserve + moveAmount,
        usdgReserve: reserves.usdgReserve - moveOut,
      };
      const postMoveQuote = quoteGlowToUsdg(targetAmountIn, movedReserves);

      if (
        postMoveQuote < onePercentMinOut &&
        postMoveQuote > fifteenPercentMinOut
      ) {
        return {
          moveAmount,
          originalQuote,
          onePercentMinOut,
          fifteenPercentMinOut,
          postMoveQuote,
        };
      }
    }

    throw new Error(
      `Could not find a high-slippage move for target ${formatUnits(
        targetAmountIn,
        18
      )} GLW with wallet balance ${formatUnits(walletGlowBalance, 18)} GLW`
    );
  }

  async function swapGlowToUsdg({
    amountIn,
    amountOutMin,
  }: {
    amountIn: bigint;
    amountOutMin: bigint;
  }) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    return walletClient.writeContract({
      address: UNISWAP_V2_ROUTER,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        [GLOW_ADDRESS, USDG_ADDRESS],
        TEST_WALLET,
        deadline,
      ],
      account: TEST_WALLET,
      chain: mainnet,
    });
  }

  beforeAll(async () => {
    if (!MAINNET_RPC_URL) {
      throw new Error("MAINNET_RPC_URL is required to run fork tests.");
    }

    const anvilArgs = [
      "--port",
      String(anvilPort),
      "--chain-id",
      String(CHAIN_ID),
      "--fork-url",
      MAINNET_RPC_URL,
      "--fork-block-number",
      String(forkBlockNumber),
    ];

    anvilProcess = spawn("anvil", anvilArgs, { stdio: "pipe" });

    publicClient = createPublicClient({
      chain: mainnet,
      transport: http(anvilRpcUrl, { timeout: 20_000 }),
    });

    walletClient = createWalletClient({
      account: TEST_WALLET,
      chain: mainnet,
      transport: http(anvilRpcUrl, { timeout: 20_000 }),
    });

    testClient = createTestClient({
      chain: mainnet,
      mode: "anvil",
      transport: http(anvilRpcUrl, { timeout: 20_000 }),
    });

    await waitForAnvilReady(forkTimeoutMs);
    await testClient.impersonateAccount({ address: TEST_WALLET });
    await testClient.setBalance({
      address: TEST_WALLET,
      value: parseUnits("10", 18),
    });

    pairAddress = (await publicClient.readContract({
      address: UNISWAP_V2_FACTORY,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [GLOW_ADDRESS, USDG_ADDRESS],
    })) as Address;
  }, 180_000);

  afterAll(async () => {
    try {
      if (testClient) {
        await testClient.stopImpersonatingAccount({ address: TEST_WALLET });
      }
    } catch {
      // no-op
    }

    if (anvilProcess && !anvilProcess.killed) {
      anvilProcess.kill("SIGTERM");
      await Promise.race([
        once(anvilProcess, "exit"),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
  });

  it(
    "fails at 1% slippage but succeeds at the new 15% default after an adverse move",
    async () => {
      expect(DEFAULT_SLIPPAGE_TOLERANCE).toBe("15");
      expect(DEFAULT_SLIPPAGE_BPS).toBe(1500n);
      expect(HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT).toBe(5);
      expect(FIFTEEN_PERCENT_BPS).toBe(1500n);

      const startingGlowBalance = await tokenBalanceOf(GLOW_ADDRESS, TEST_WALLET);
      expect(startingGlowBalance).toBeGreaterThan(TARGET_SWAP_GLOW);

      await ensureGlowAllowance(startingGlowBalance);

      const originalReserves = await getGlowUsdgReserves();
      const scenario = findAdverseMoveAmount({
        walletGlowBalance: startingGlowBalance,
        targetAmountIn: TARGET_SWAP_GLOW,
        reserves: originalReserves,
      });

      const moveHash = await swapGlowToUsdg({
        amountIn: scenario.moveAmount,
        amountOutMin: 1n,
      });
      const moveReceipt = await publicClient.waitForTransactionReceipt({
        hash: moveHash,
      });
      expect(moveReceipt.status).toBe("success");

      const movedReserves = await getGlowUsdgReserves();
      const quoteAfterMove = quoteGlowToUsdg(TARGET_SWAP_GLOW, movedReserves);

      expect(quoteAfterMove).toBeLessThan(scenario.onePercentMinOut);
      expect(quoteAfterMove).toBeGreaterThan(scenario.fifteenPercentMinOut);

      await expect(
        publicClient.simulateContract({
          address: UNISWAP_V2_ROUTER,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [
            TARGET_SWAP_GLOW,
            scenario.onePercentMinOut,
            [GLOW_ADDRESS, USDG_ADDRESS],
            TEST_WALLET,
            BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
          ],
          account: TEST_WALLET,
        })
      ).rejects.toThrow(/INSUFFICIENT_OUTPUT_AMOUNT|revert|output/i);

      const usdgBefore = await tokenBalanceOf(USDG_ADDRESS, TEST_WALLET);

      const highSlippageHash = await swapGlowToUsdg({
        amountIn: TARGET_SWAP_GLOW,
        amountOutMin: scenario.fifteenPercentMinOut,
      });
      const highSlippageReceipt = await publicClient.waitForTransactionReceipt({
        hash: highSlippageHash,
      });
      expect(highSlippageReceipt.status).toBe("success");

      const usdgAfter = await tokenBalanceOf(USDG_ADDRESS, TEST_WALLET);
      const usdgReceived = usdgAfter - usdgBefore;

      expect(usdgReceived).toBeGreaterThanOrEqual(scenario.fifteenPercentMinOut);
      expect(usdgReceived).toBeLessThan(scenario.originalQuote);
      expect(formatUnits(scenario.onePercentMinOut, 6)).not.toBe(
        formatUnits(scenario.fifteenPercentMinOut, 6)
      );
    },
    240_000
  );
});
