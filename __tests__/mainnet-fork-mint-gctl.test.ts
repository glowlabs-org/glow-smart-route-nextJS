import "dotenv/config";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  maxUint256,
  parseAbi,
  parseEther,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { FORWARDER_ABI, getAddresses } from "@glowlabs-org/utils/browser";

/**
 * Run manually (disabled by default):
 * RUN_MAINNET_FORK_TESTS=1 pnpm dlx vitest run __tests__/mainnet-fork-mint-gctl.test.ts
 */

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ?? process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
const SHOULD_RUN_FORK_TEST =
  process.env.RUN_MAINNET_FORK_TESTS === "1" && Boolean(MAINNET_RPC_URL);

const describeFork = SHOULD_RUN_FORK_TEST ? describe : describe.skip;

const TEST_WALLET = "0x5e230FED487c86B90f6508104149F087d9B1B0A7" as Address;
const REGION_ID = 1;
const TEN_CENTS_USDC = 100_000n; // 0.10 USDC (6 decimals)
const CHAIN_ID = 1;

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) external payable returns (uint256[] amounts)",
]);

describeFork("mainnet fork: mint GCTL with ETH path and USDC path", () => {
  const anvilPort = Number(process.env.MAINNET_FORK_TEST_PORT ?? "8547");
  const anvilRpcUrl = `http://127.0.0.1:${anvilPort}`;
  const forkTimeoutMs = Number(process.env.MAINNET_FORK_TIMEOUT_MS ?? "90000");

  const addresses = getAddresses(CHAIN_ID);
  const message = `MintGCTLAndStake::${REGION_ID}`;

  let anvilProcess: ChildProcessWithoutNullStreams | null = null;
  let publicClient: ReturnType<typeof createPublicClient>;
  let walletClient: ReturnType<typeof createWalletClient>;
  let testClient: ReturnType<typeof createTestClient>;
  let wethAddress: Address;

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

  async function quoteUsdcOut(ethInWei: bigint) {
    const amounts = (await publicClient.readContract({
      address: addresses.UNISWAP_V2_ROUTER,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [ethInWei, [wethAddress, addresses.USDC]],
    })) as readonly bigint[];
    return amounts[1] ?? 0n;
  }

  async function findEthInputForAtLeastUsdc(targetUsdc6: bigint) {
    let amountIn = parseEther("0.00005");
    for (let i = 0; i < 10; i += 1) {
      const quotedOut = await quoteUsdcOut(amountIn);
      if (quotedOut >= targetUsdc6) return amountIn;
      amountIn *= 2n;
    }
    throw new Error(
      `Could not find ETH input for at least ${targetUsdc6} USDC units`
    );
  }

  async function usdcBalanceOf(wallet: Address) {
    return (await publicClient.readContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet],
    })) as bigint;
  }

  async function ensureUsdcAllowance(amountUsdc6: bigint) {
    const allowance = (await publicClient.readContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [TEST_WALLET, addresses.FORWARDER],
    })) as bigint;

    if (allowance >= amountUsdc6) return;

    const approveHash = await walletClient.writeContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [addresses.FORWARDER, maxUint256],
      account: TEST_WALLET,
      chain: mainnet,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    expect(approveReceipt.status).toBe("success");
  }

  async function swapEthToUsdcForAtLeast(targetUsdc6: bigint) {
    const ethInWei = await findEthInputForAtLeastUsdc(targetUsdc6);

    const usdcBefore = await usdcBalanceOf(TEST_WALLET);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

    const swapHash = await walletClient.writeContract({
      address: addresses.UNISWAP_V2_ROUTER,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "swapExactETHForTokens",
      args: [1n, [wethAddress, addresses.USDC], TEST_WALLET, deadline],
      value: ethInWei,
      account: TEST_WALLET,
      chain: mainnet,
    });

    const swapReceipt = await publicClient.waitForTransactionReceipt({
      hash: swapHash,
    });
    expect(swapReceipt.status).toBe("success");

    const usdcAfter = await usdcBalanceOf(TEST_WALLET);
    const usdcReceived = usdcAfter > usdcBefore ? usdcAfter - usdcBefore : 0n;

    expect(usdcReceived).toBeGreaterThanOrEqual(targetUsdc6);
    return { ethInWei, usdcReceived };
  }

  async function mintAndStakeWithUsdc(amountUsdc6: bigint) {
    await ensureUsdcAllowance(amountUsdc6);

    await publicClient.simulateContract({
      address: addresses.FORWARDER,
      abi: FORWARDER_ABI,
      functionName: "swapUSDCAndForwardUSDG",
      args: [amountUsdc6, addresses.FOUNDATION_WALLET, true, message],
      account: TEST_WALLET,
    });

    const mintHash = await walletClient.writeContract({
      address: addresses.FORWARDER,
      abi: FORWARDER_ABI,
      functionName: "swapUSDCAndForwardUSDG",
      args: [amountUsdc6, addresses.FOUNDATION_WALLET, true, message],
      account: TEST_WALLET,
      chain: mainnet,
    });

    const mintReceipt = await publicClient.waitForTransactionReceipt({
      hash: mintHash,
    });
    expect(mintReceipt.status).toBe("success");
    return mintHash;
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
    ];

    if (process.env.MAINNET_FORK_BLOCK_NUMBER) {
      anvilArgs.push(
        "--fork-block-number",
        process.env.MAINNET_FORK_BLOCK_NUMBER
      );
    }

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
      value: parseEther("10"),
    });

    wethAddress = (await publicClient.readContract({
      address: addresses.UNISWAP_V2_ROUTER,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "WETH",
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
    "executes 0.10 USDC mint+stake via ETH path and direct USDC path",
    async () => {
      // ETH path: swap ETH -> USDC, then mint/stake 10 cents.
      await swapEthToUsdcForAtLeast(TEN_CENTS_USDC);
      const usdcAfterEthSwap = await usdcBalanceOf(TEST_WALLET);
      expect(usdcAfterEthSwap).toBeGreaterThanOrEqual(TEN_CENTS_USDC);
      await mintAndStakeWithUsdc(TEN_CENTS_USDC);

      // USDC path: ensure enough USDC balance, then mint/stake 10 cents directly with USDC.
      const usdcBeforeUsdcMint = await usdcBalanceOf(TEST_WALLET);
      if (usdcBeforeUsdcMint < TEN_CENTS_USDC) {
        await swapEthToUsdcForAtLeast(TEN_CENTS_USDC - usdcBeforeUsdcMint);
      }
      await mintAndStakeWithUsdc(TEN_CENTS_USDC);
    },
    240_000
  );
});

