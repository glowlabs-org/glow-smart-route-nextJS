/**
 * Script to inspect claim flow data for a wallet
 * Run with: npx tsx scripts/inspect-claim-flow.ts
 *
 * Optional flags:
 *   --wallet=0x...      Wallet to inspect (default: 0x50f5...)
 *   --start-week=97     Week (V2) to start aggregate tallies
 *   --summary-only      Skip per-wallet breakdown; only totals
 *   --cache             Load/save swap + claim data to .cache/claim-flow-data.json
 *   --refresh-cache     Force refetch and overwrite cache file
 *   --cache-file=path   Override cache file location
 */

import fs from "node:fs";
import path from "node:path";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { mainnet } from "viem/chains";
import * as dotenv from "dotenv";
import { addresses } from "@/web3/constants/addresses";
import { glowUSDGPair } from "@/web3/constants/pairs/UniV2Pairs";

type HexAddress = `0x${string}`;

const DEFAULT_WALLET =
  "0x50f522ffe01db47effa932dc7d020f26565efd6b" as HexAddress;
const GENESIS_TIMESTAMP = 1699466400;
const FIRST_V2_WEEK = 97;
const SECONDS_PER_WEEK = 7 * 86_400;
const BLOCKS_PER_DAY = BigInt(7_200); // ~12s block time
const SWAP_LOOKBACK_DAYS = 90;
const SWAP_CHUNK_SIZE = BigInt(15_000);

interface ScriptOptions {
  wallet: HexAddress;
  startWeek: number;
  summaryOnly: boolean;
  useCache: boolean;
  refreshCache: boolean;
  cacheFile: string;
}

function isHexAddress(value?: string | null): value is HexAddress {
  if (!value) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseScriptOptions(): ScriptOptions {
  let wallet: HexAddress | null = null;
  let startWeek = FIRST_V2_WEEK;
  let summaryOnly = false;
  let useCache = false;
  let refreshCache = false;
  let cacheFile = path.join(process.cwd(), ".cache", "claim-flow-data.json");

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--wallet=")) {
      const candidate = arg.split("=")[1];
      if (isHexAddress(candidate)) {
        wallet = candidate.toLowerCase() as HexAddress;
      } else {
        console.warn("Ignoring invalid wallet argument:", candidate);
      }
    } else if (arg.startsWith("--start-week=")) {
      const candidate = Number(arg.split("=")[1]);
      if (!Number.isNaN(candidate)) {
        startWeek = candidate;
      }
    } else if (arg === "--summary-only") {
      summaryOnly = true;
    } else if (arg === "--cache") {
      useCache = true;
    } else if (arg === "--refresh-cache") {
      useCache = true;
      refreshCache = true;
    } else if (arg.startsWith("--cache-file=")) {
      const candidate = arg.split("=")[1];
      if (candidate) {
        cacheFile = path.isAbsolute(candidate)
          ? candidate
          : path.join(process.cwd(), candidate);
      }
    }
  }

  return {
    wallet: wallet ?? DEFAULT_WALLET,
    startWeek,
    summaryOnly,
    useCache,
    refreshCache,
    cacheFile,
  };
}

const SCRIPT_OPTIONS = parseScriptOptions();
const WALLET = SCRIPT_OPTIONS.wallet;
const START_WEEK = SCRIPT_OPTIONS.startWeek;
const SUMMARY_ONLY = SCRIPT_OPTIONS.summaryOnly;
const CACHE_ENABLED = SCRIPT_OPTIONS.useCache;
const REFRESH_CACHE = SCRIPT_OPTIONS.refreshCache;
const CACHE_FILE = SCRIPT_OPTIONS.cacheFile;

// Contract addresses (mainnet)
const REWARDS_KERNEL =
  "0xd6d3139d40a32F8bA71D576c1A743529AB4786BB" as HexAddress;
const MINER_POOL_GCA = addresses.gcaAndMinerPoolContract as HexAddress;
const GLW_TOKEN = addresses.glow as HexAddress;

dotenv.config({ path: ".env.local" });

const HUB_URL =
  process.env.NEXT_PUBLIC_HUB_URL ??
  "https://gca-crm-backend-production-1f2a.up.railway.app";

const blockTimestampCache = new Map<string, number>();

function weekToTimestamp(week: number) {
  return (GENESIS_TIMESTAMP + week * SECONDS_PER_WEEK) * 1000;
}

function nonceToWeek(nonce: bigint): number {
  return Number(nonce) + FIRST_V2_WEEK;
}

function timestampToWeek(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000);
  if (seconds <= GENESIS_TIMESTAMP) return FIRST_V2_WEEK;
  const delta = seconds - GENESIS_TIMESTAMP;
  return Math.floor(delta / SECONDS_PER_WEEK);
}

async function getBlockTimestamp(blockNumber: bigint) {
  const key = blockNumber.toString();
  if (blockTimestampCache.has(key)) {
    return blockTimestampCache.get(key)!;
  }
  const block = await client.getBlock({ blockNumber });
  const timestampMs = Number(block.timestamp) * 1000;
  blockTimestampCache.set(key, timestampMs);
  return timestampMs;
}

function glwToNumber(value: bigint) {
  return Number(formatUnits(value, 18));
}

function unitsToNumber(value: bigint, decimals: number) {
  return Number(formatUnits(value, decimals));
}

function formatGlw(value: bigint, fractionDigits = 2) {
  return glwToNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatNumber(value: number, fractionDigits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

function shortAddress(addressValue: string) {
  if (!addressValue) return "";
  return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
}

function formatDateTimeString(timestamp?: number | null) {
  if (!timestamp) return "n/a";
  return new Date(timestamp).toLocaleString();
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  return BigInt(0);
}

// Use the project's mainnet RPC or fall back to public RPC
const rpcUrl =
  "https://eth-mainnet.g.alchemy.com/v2/dK_eaVLATMhv_n7dCGHZvqh8HOHuqE9u";
console.log("Using RPC:", rpcUrl.substring(0, 50) + "...");

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 60_000 }),
});

// ABI fragments for events
const REWARD_CLAIMED_EVENT = parseAbiItem(
  "event RewardClaimed(address indexed user, address indexed to, uint256 indexed nonce, address from, (address token, uint256 amount)[] taa, bool[] isGuarded)"
);

// Transfer event for GLW (to track inflation claims)
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
);

interface WalletSwapAggregate {
  wallet: string;
  swapCount: number;
  glwSold: number;
  glwBought: number;
  usdgReceived: number;
  usdgSpent: number;
  firstSwap: number | null;
  lastSwap: number | null;
}

interface SwapAnalysisResult {
  fromBlock: bigint;
  toBlock: bigint;
  logsCount: number;
  windowStartMs: number;
  windowEndMs: number;
  walletAggregates: Map<string, WalletSwapAggregate>;
}

interface SerializedWalletSwapAggregate extends WalletSwapAggregate {}

interface SerializedSwapAnalysis {
  fromBlock: string;
  toBlock: string;
  logsCount: number;
  windowStartMs: number;
  windowEndMs: number;
  walletAggregates: SerializedWalletSwapAggregate[];
}

interface SerializedWalletClaimTotals extends WalletClaimTotals {}

interface SerializedClaimData {
  protocolTotal: string;
  inflationTotal: string;
  walletTotals: SerializedWalletClaimTotals[];
}

interface CachePayload {
  generatedAt: string;
  startWeek: number;
  swaps: SerializedSwapAnalysis;
  claims: SerializedClaimData;
}

function serializeSwapAnalysis(
  result: SwapAnalysisResult
): SerializedSwapAnalysis {
  return {
    fromBlock: result.fromBlock.toString(),
    toBlock: result.toBlock.toString(),
    logsCount: result.logsCount,
    windowStartMs: result.windowStartMs,
    windowEndMs: result.windowEndMs,
    walletAggregates: Array.from(result.walletAggregates.values()),
  };
}

function deserializeSwapAnalysis(
  data: SerializedSwapAnalysis
): SwapAnalysisResult {
  return {
    fromBlock: BigInt(data.fromBlock),
    toBlock: BigInt(data.toBlock),
    logsCount: data.logsCount,
    windowStartMs: data.windowStartMs,
    windowEndMs: data.windowEndMs,
    walletAggregates: new Map(
      data.walletAggregates.map((agg) => [agg.wallet, { ...agg }])
    ),
  };
}

async function fetchRecentSwaps(): Promise<SwapAnalysisResult> {
  console.log("\n6. RECENT GLW/USDG SWAPS (last 90 days)");
  console.log("-".repeat(70));

  const pairAddress = glowUSDGPair.pairAddress as HexAddress;
  const glwLower = GLW_TOKEN.toLowerCase();
  const token0Lower = glowUSDGPair.token0.address.toLowerCase();
  const token1Lower = glowUSDGPair.token1.address.toLowerCase();
  const token0IsGlw = token0Lower === glwLower;
  const glwDecimals = token0IsGlw
    ? glowUSDGPair.token0.decimals
    : glowUSDGPair.token1.decimals;
  const usdgDecimals = token0IsGlw
    ? glowUSDGPair.token1.decimals
    : glowUSDGPair.token0.decimals;

  const currentBlock = await client.getBlockNumber();
  const lookbackBlocks = BLOCKS_PER_DAY * BigInt(SWAP_LOOKBACK_DAYS);
  const fromBlock =
    currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : BigInt(0);
  const swapLogs: any[] = [];

  console.log(
    `Scanning blocks ${fromBlock.toString()} → ${currentBlock.toString()} (~${SWAP_LOOKBACK_DAYS}d window)`
  );

  for (let start = fromBlock; start <= currentBlock; start += SWAP_CHUNK_SIZE) {
    const tentativeEnd = start + SWAP_CHUNK_SIZE - BigInt(1);
    const end = tentativeEnd > currentBlock ? currentBlock : tentativeEnd;

    try {
      const chunk = await client.getLogs({
        address: pairAddress,
        event: SWAP_EVENT,
        fromBlock: start,
        toBlock: end,
      });

      if (chunk.length > 0) {
        swapLogs.push(...chunk);
        console.log(
          `  + ${
            chunk.length
          } swaps in blocks ${start.toString()}-${end.toString()}`
        );
      }
    } catch (error: any) {
      console.warn(
        `  Skipped swap logs for blocks ${start.toString()}-${end.toString()}:`,
        error.message ?? error
      );
    }
  }

  const walletAggregates = new Map<string, WalletSwapAggregate>();
  const txSenderCache = new Map<string, string>();

  const getTxSender = async (hash: `0x${string}`) => {
    if (txSenderCache.has(hash)) {
      return txSenderCache.get(hash)!;
    }
    const tx = await client.getTransaction({ hash });
    const from = tx.from.toLowerCase();
    txSenderCache.set(hash, from);
    return from;
  };

  for (const log of swapLogs) {
    if (!log.transactionHash || !log.args) continue;
    const txHash = log.transactionHash as `0x${string}`;
    const wallet = await getTxSender(txHash);
    if (!wallet) continue;

    const timestamp = await getBlockTimestamp(log.blockNumber);

    let glwIntoPair = 0;
    let glwOutOfPair = 0;
    let usdgIntoPair = 0;
    let usdgOutOfPair = 0;

    if (token0IsGlw) {
      glwIntoPair = unitsToNumber(log.args.amount0In, glwDecimals);
      glwOutOfPair = unitsToNumber(log.args.amount0Out, glwDecimals);
      usdgIntoPair = unitsToNumber(log.args.amount1In, usdgDecimals);
      usdgOutOfPair = unitsToNumber(log.args.amount1Out, usdgDecimals);
    } else {
      glwIntoPair = unitsToNumber(log.args.amount1In, glwDecimals);
      glwOutOfPair = unitsToNumber(log.args.amount1Out, glwDecimals);
      usdgIntoPair = unitsToNumber(log.args.amount0In, usdgDecimals);
      usdgOutOfPair = unitsToNumber(log.args.amount0Out, usdgDecimals);
    }

    const aggregate = walletAggregates.get(wallet) ?? {
      wallet,
      swapCount: 0,
      glwSold: 0,
      glwBought: 0,
      usdgReceived: 0,
      usdgSpent: 0,
      firstSwap: null,
      lastSwap: null,
    };

    aggregate.swapCount += 1;
    aggregate.glwSold += glwIntoPair;
    aggregate.glwBought += glwOutOfPair;
    aggregate.usdgReceived += usdgOutOfPair;
    aggregate.usdgSpent += usdgIntoPair;
    aggregate.firstSwap =
      aggregate.firstSwap === null
        ? timestamp
        : Math.min(aggregate.firstSwap, timestamp);
    aggregate.lastSwap =
      aggregate.lastSwap === null
        ? timestamp
        : Math.max(aggregate.lastSwap, timestamp);

    walletAggregates.set(wallet, aggregate);
  }

  const windowEndMs = await getBlockTimestamp(currentBlock);
  const windowStartMs = windowEndMs - SWAP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  return {
    fromBlock,
    toBlock: currentBlock,
    logsCount: swapLogs.length,
    windowStartMs,
    windowEndMs,
    walletAggregates,
  };
}

function printSwapSummary(result: SwapAnalysisResult) {
  const aggregateList = Array.from(result.walletAggregates.values());
  const totalSwaps = aggregateList.reduce((sum, agg) => sum + agg.swapCount, 0);

  const totals = aggregateList.reduce(
    (acc, agg) => {
      acc.glwSold += agg.glwSold;
      acc.glwBought += agg.glwBought;
      acc.usdgReceived += agg.usdgReceived;
      acc.usdgSpent += agg.usdgSpent;
      return acc;
    },
    { glwSold: 0, glwBought: 0, usdgReceived: 0, usdgSpent: 0 }
  );

  console.log(
    `Window: ${new Date(result.windowStartMs).toLocaleString()} → ${new Date(
      result.windowEndMs
    ).toLocaleString()}`
  );
  console.log(`Swap logs processed: ${result.logsCount}`);
  console.log(
    `Unique wallets swapping GLW/USDG: ${aggregateList.length} (total swaps: ${totalSwaps})`
  );
  console.log(
    `GLW sold: ${formatNumber(totals.glwSold)} · GLW bought: ${formatNumber(
      totals.glwBought
    )}`
  );
  console.log(
    `USDG received: ${formatNumber(
      totals.usdgReceived
    )} · USDG spent: ${formatNumber(totals.usdgSpent)}`
  );

  const leaderboard = aggregateList
    .slice()
    .sort((a, b) => b.glwSold - a.glwSold)
    .slice(0, 15)
    .map((agg) => ({
      wallet: shortAddress(agg.wallet),
      swaps: agg.swapCount,
      glwSold: formatNumber(agg.glwSold),
      usdgReceived: formatNumber(agg.usdgReceived),
      glwBought: formatNumber(agg.glwBought),
      usdgSpent: formatNumber(agg.usdgSpent),
      lastSwap: formatDateTimeString(agg.lastSwap),
    }));

  if (leaderboard.length > 0) {
    console.log("\nTop wallets by GLW sold (past 90 days):");
    console.table(leaderboard);
  } else {
    console.log("No GLW/USDG swap activity detected in the selected window.");
  }
}

interface WalletActivityEntry {
  walletAddress: string;
  glwDelegated: string;
  usdcSpentOnMiners: string;
  delegatorRewardsEarned: string;
  minerRewardsEarned: string;
  totalRewardsEarned: string;
}

interface WalletsActivityResponse {
  weekRange: {
    startWeek: number;
    endWeek: number;
  };
  summary: {
    totalWallets: number;
    returnedWallets: number;
  };
  wallets: WalletActivityEntry[];
}

interface WalletParticipationSummary {
  delegators: Set<string>;
  miners: Set<string>;
  overlap: Set<string>;
  combined: Set<string>;
  delegatorData: WalletsActivityResponse | null;
  minerData: WalletsActivityResponse | null;
}

async function fetchWalletsActivity(
  type: "delegator" | "miner",
  limit = 500
): Promise<WalletsActivityResponse> {
  const params = new URLSearchParams({
    type,
    limit: String(limit),
    sortBy: "totalRewardsEarned",
  });

  const response = await fetch(
    `${HUB_URL}/fractions/wallets/activity?${params.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch wallets activity (${type}): ${response.status} - ${errorText}`
    );
  }

  return (await response.json()) as WalletsActivityResponse;
}

async function fetchParticipationWallets(
  limit = 500
): Promise<WalletParticipationSummary> {
  console.log("\n7. DELEGATOR / MINER PARTICIPATION (Hub API)");
  console.log("-".repeat(70));

  const [delegatorData, minerData] = await Promise.all([
    fetchWalletsActivity("delegator", limit).catch((error) => {
      console.warn(
        "Failed to load delegator activity:",
        error.message ?? error
      );
      return null;
    }),
    fetchWalletsActivity("miner", limit).catch((error) => {
      console.warn("Failed to load miner activity:", error.message ?? error);
      return null;
    }),
  ]);

  const delegators = new Set<string>();
  const miners = new Set<string>();

  (delegatorData?.wallets ?? []).forEach((entry) => {
    if (entry.walletAddress) {
      delegators.add(entry.walletAddress.toLowerCase());
    }
  });

  (minerData?.wallets ?? []).forEach((entry) => {
    if (entry.walletAddress) {
      miners.add(entry.walletAddress.toLowerCase());
    }
  });

  const combined = new Set<string>();
  delegators.forEach((wallet) => combined.add(wallet));
  miners.forEach((wallet) => combined.add(wallet));

  const overlap = new Set<string>();
  delegators.forEach((wallet) => {
    if (miners.has(wallet)) {
      overlap.add(wallet);
    }
  });

  return {
    delegators,
    miners,
    overlap,
    combined,
    delegatorData,
    minerData,
  };
}

function printParticipationSummary(
  participation: WalletParticipationSummary,
  swapAnalysis: SwapAnalysisResult
) {
  const swapWallets = new Set(swapAnalysis.walletAggregates.keys());

  const delegatorsWithSwaps = Array.from(participation.delegators).filter(
    (wallet) => swapWallets.has(wallet)
  ).length;
  const minersWithSwaps = Array.from(participation.miners).filter((wallet) =>
    swapWallets.has(wallet)
  ).length;

  console.log(
    `Delegator wallets: ${participation.delegators.size}, Miner wallets: ${participation.miners.size}`
  );
  console.log(
    `Unique wallets with delegation or miner activity: ${participation.combined.size} (overlap: ${participation.overlap.size})`
  );
  console.log(
    `Delegators who also swapped in the last 90d: ${delegatorsWithSwaps}, miners who swapped: ${minersWithSwaps}`
  );

  const roster = Array.from(participation.combined)
    .sort()
    .map((wallet) => ({
      wallet: shortAddress(wallet),
      role: participation.overlap.has(wallet)
        ? "both"
        : participation.delegators.has(wallet)
        ? "delegator"
        : "miner",
      swapped90d: swapWallets.has(wallet) ? "yes" : "no",
    }));

  if (roster.length > 0) {
    console.log("\nWallet roster (delegated or bought miners):");
    console.table(roster);
  }
}

interface WalletClaimTotals {
  wallet: string;
  protocolGlw: number;
  inflationGlw: number;
  totalGlw: number;
  protocolClaims: number;
  inflationClaims: number;
  firstClaimTs: number | null;
  lastClaimTs: number | null;
}

interface ClaimData {
  walletTotals: Map<string, WalletClaimTotals>;
  protocolTotal: bigint;
  inflationTotal: bigint;
}

function serializeClaimData(claimData: ClaimData): SerializedClaimData {
  return {
    protocolTotal: claimData.protocolTotal.toString(),
    inflationTotal: claimData.inflationTotal.toString(),
    walletTotals: Array.from(claimData.walletTotals.values()),
  };
}

function deserializeClaimData(data: SerializedClaimData): ClaimData {
  return {
    protocolTotal: BigInt(data.protocolTotal),
    inflationTotal: BigInt(data.inflationTotal),
    walletTotals: new Map(
      data.walletTotals.map((entry) => [entry.wallet, { ...entry }])
    ),
  };
}

function ensureCacheDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadCachePayload(filePath: string): CachePayload | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CachePayload;
  } catch (error: any) {
    console.warn("Failed to read cache file:", error.message ?? error);
    return null;
  }
}

function saveCachePayload(filePath: string, payload: CachePayload) {
  try {
    ensureCacheDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`Cache saved to ${filePath}`);
  } catch (error: any) {
    console.warn("Unable to write cache file:", error.message ?? error);
  }
}

function createWalletClaimTotals(wallet: string): WalletClaimTotals {
  return {
    wallet,
    protocolGlw: 0,
    inflationGlw: 0,
    totalGlw: 0,
    protocolClaims: 0,
    inflationClaims: 0,
    firstClaimTs: null,
    lastClaimTs: null,
  };
}

async function buildClaimData(startWeek: number): Promise<ClaimData> {
  console.log("\nComputing on-chain claim totals...");
  const [protocolLogs, inflationLogs] = await Promise.all([
    fetchProtocolClaimEvents(),
    fetchGlwTransfers(),
  ]);

  const walletTotals = new Map<string, WalletClaimTotals>();
  const glwLower = GLW_TOKEN.toLowerCase();
  let protocolTotal = BigInt(0);
  let inflationTotal = BigInt(0);

  for (const log of protocolLogs) {
    const nonce = log.args?.nonce;
    if (nonce === undefined || nonce === null) continue;
    const week = nonceToWeek(nonce);
    if (week < startWeek) continue;

    const taa = log.args?.taa || [];
    const glwAmount = taa.find(
      (entry: any) => entry.token?.toLowerCase() === glwLower
    );
    if (!glwAmount) continue;

    const amountBig = toBigInt(glwAmount.amount);
    if (amountBig === BigInt(0)) continue;

    const wallet = (log.args?.user ?? log.args?.to)?.toLowerCase();
    if (!wallet) continue;

    const timestamp = await getBlockTimestamp(log.blockNumber);
    const amountNum = glwToNumber(amountBig);

    protocolTotal += amountBig;

    const entry = walletTotals.get(wallet) ?? createWalletClaimTotals(wallet);
    entry.protocolGlw += amountNum;
    entry.totalGlw += amountNum;
    entry.protocolClaims += 1;
    entry.firstClaimTs =
      entry.firstClaimTs === null
        ? timestamp
        : Math.min(entry.firstClaimTs, timestamp);
    entry.lastClaimTs =
      entry.lastClaimTs === null
        ? timestamp
        : Math.max(entry.lastClaimTs, timestamp);

    walletTotals.set(wallet, entry);
  }

  for (const log of inflationLogs) {
    const amountBig = toBigInt(log.args?.value);
    if (amountBig === BigInt(0)) continue;

    const timestamp = await getBlockTimestamp(log.blockNumber);
    const week = timestampToWeek(timestamp);
    if (week < startWeek) continue;

    const wallet = log.args?.to?.toLowerCase();
    if (!wallet) continue;

    const amountNum = glwToNumber(amountBig);
    inflationTotal += amountBig;

    const entry = walletTotals.get(wallet) ?? createWalletClaimTotals(wallet);
    entry.inflationGlw += amountNum;
    entry.totalGlw += amountNum;
    entry.inflationClaims += 1;
    entry.firstClaimTs =
      entry.firstClaimTs === null
        ? timestamp
        : Math.min(entry.firstClaimTs, timestamp);
    entry.lastClaimTs =
      entry.lastClaimTs === null
        ? timestamp
        : Math.max(entry.lastClaimTs, timestamp);

    walletTotals.set(wallet, entry);
  }

  console.log(
    `Processed ${walletTotals.size} wallets with claims since week ${startWeek}`
  );

  return {
    walletTotals,
    protocolTotal,
    inflationTotal,
  };
}

function summarizeParticipationClaims(
  participation: WalletParticipationSummary,
  claimData: ClaimData,
  swapAnalysis: SwapAnalysisResult,
  startWeek: number
) {
  console.log(
    `\n8. CLAIMS FOR PARTICIPATING WALLETS (since week ${startWeek})`
  );
  console.log("-".repeat(70));

  const swapWallets = new Set(swapAnalysis.walletAggregates.keys());

  const claimedEntries: WalletClaimTotals[] = [];
  participation.combined.forEach((wallet) => {
    const entry = claimData.walletTotals.get(wallet);
    if (entry) {
      claimedEntries.push(entry);
    }
  });

  const walletsWithClaims = claimedEntries.length;
  const walletsWithoutClaims = participation.combined.size - walletsWithClaims;
  const walletsWithSwaps = claimedEntries.filter((entry) =>
    swapWallets.has(entry.wallet)
  ).length;

  const totalClaimedByParticipants = claimedEntries.reduce(
    (acc, entry) => acc + entry.totalGlw,
    0
  );

  const perWalletDump = new Map<
    string,
    { sold: number; dumpedFromClaims: number }
  >();

  const dumpStats = claimedEntries.reduce(
    (acc, entry) => {
      const swapStats = swapAnalysis.walletAggregates.get(entry.wallet);
      const sold = swapStats?.glwSold ?? 0;
      const cappedDump = Math.min(sold, entry.totalGlw);
      perWalletDump.set(entry.wallet, {
        sold,
        dumpedFromClaims: cappedDump,
      });
      acc.totalSold += sold;
      acc.dumpedFromClaims += cappedDump;
      if (cappedDump > 0) acc.dumpingWallets += 1;
      return acc;
    },
    { totalSold: 0, dumpedFromClaims: 0, dumpingWallets: 0 }
  );

  console.log(
    `Wallets with claims: ${walletsWithClaims} / ${participation.combined.size} (no-claim wallets: ${walletsWithoutClaims})`
  );
  console.log(
    `Wallets that both claimed and swapped (90d window): ${walletsWithSwaps}`
  );
  console.log(
    `Total GLW claimed by these wallets: ${formatNumber(
      totalClaimedByParticipants
    )} GLW`
  );
  console.log(
    `GLW sold in last 90d by these claiming wallets: ${formatNumber(
      dumpStats.totalSold
    )} GLW`
  );
  console.log(
    `GLW dumped from claimed rewards (capped by claims): ${formatNumber(
      dumpStats.dumpedFromClaims
    )} GLW${
      totalClaimedByParticipants > 0
        ? ` (${formatPercent(
            dumpStats.dumpedFromClaims / totalClaimedByParticipants
          )} of claimed)`
        : ""
    }`
  );
  console.log(
    `Wallets dumping claimed GLW: ${dumpStats.dumpingWallets} / ${walletsWithClaims}`
  );

  const leaderboard = claimedEntries
    .slice()
    .sort((a, b) => b.totalGlw - a.totalGlw)
    .slice(0, 20)
    .map((entry) => {
      const dumpMetrics = perWalletDump.get(entry.wallet) ?? {
        sold: 0,
        dumpedFromClaims: 0,
      };
      const dumpShare =
        entry.totalGlw > 0
          ? formatPercent(dumpMetrics.dumpedFromClaims / entry.totalGlw)
          : "0%";
      return {
        wallet: shortAddress(entry.wallet),
        protocolGLW: formatNumber(entry.protocolGlw),
        inflationGLW: formatNumber(entry.inflationGlw),
        totalGLW: formatNumber(entry.totalGlw),
        claims: entry.protocolClaims + entry.inflationClaims,
        glwSold90d: formatNumber(dumpMetrics.sold),
        dumpedFromClaims: formatNumber(dumpMetrics.dumpedFromClaims),
        dumpShare,
        lastClaim: formatDateTimeString(entry.lastClaimTs),
      };
    });

  if (leaderboard.length > 0) {
    console.log("\nTop wallets by GLW claimed (participants subset):");
    console.table(leaderboard);
  } else {
    console.log("No claims found for participating wallets in this range.");
  }
}

async function fetchProtocolClaimEvents(targetWallet?: HexAddress) {
  console.log("Fetching RewardClaimed events from Rewards Kernel...");
  console.log("Contract:", REWARDS_KERNEL);
  if (targetWallet) {
    console.log("Wallet filter:", targetWallet);
  } else {
    console.log("Wallet filter: <all wallets>");
  }

  // Get logs in chunks to avoid RPC limits
  const currentBlock = await client.getBlockNumber();
  // Start from block ~21M (October 2024) - claims are recent
  const startBlock = BigInt(21_000_000);
  const chunkSize = BigInt(10_000); // Smaller chunks for public RPCs

  const allLogs: any[] = [];

  for (
    let fromBlock = startBlock;
    fromBlock < currentBlock;
    fromBlock += chunkSize
  ) {
    const toBlock =
      fromBlock + chunkSize - BigInt(1) > currentBlock
        ? currentBlock
        : fromBlock + chunkSize - BigInt(1);

    const baseFilter: Record<string, unknown> = {
      address: REWARDS_KERNEL,
      event: REWARD_CLAIMED_EVENT,
      fromBlock,
      toBlock,
    };

    if (targetWallet) {
      baseFilter.args = { user: targetWallet };
    }

    try {
      const logs = await client.getLogs(baseFilter as any);

      if (logs.length > 0) {
        allLogs.push(...logs);
        console.log(
          `  Found ${logs.length} logs in blocks ${fromBlock}-${toBlock}`
        );
      }
    } catch (error: any) {
      if (targetWallet) {
        // Try to check with `to` arg instead
        try {
          const fallbackFilter = {
            ...baseFilter,
            args: { to: targetWallet },
          };
          const logs = await client.getLogs(fallbackFilter as any);

          if (logs.length > 0) {
            allLogs.push(...logs);
            console.log(
              `  Found ${logs.length} logs (to) in blocks ${fromBlock}-${toBlock}`
            );
          }
        } catch {
          // Silent skip for chunks with errors
        }
      } else {
        console.warn(
          `  Skipped blocks ${fromBlock}-${toBlock} due to error:`,
          error.message?.substring(0, 80) ?? error
        );
      }
    }
  }

  console.log(`Total RewardClaimed events found: ${allLogs.length}`);
  return allLogs;
}

interface TransferQueryOptions {
  wallet?: HexAddress;
  fromAddress?: HexAddress;
  startBlock?: bigint;
}

async function fetchGlwTransfers({
  wallet,
  fromAddress = MINER_POOL_GCA,
  startBlock = BigInt(20_000_000),
}: TransferQueryOptions = {}) {
  console.log(
    "\nFetching GLW Transfer events (inflation claims via MinerPool)..."
  );
  if (wallet) {
    console.log("Wallet filter:", wallet);
  } else {
    console.log("Wallet filter: <all wallets>");
  }

  const currentBlock = await client.getBlockNumber();
  const chunkSize = BigInt(50_000);

  const allLogs: any[] = [];
  const args: Record<string, HexAddress> = {};
  if (fromAddress) {
    args.from = fromAddress;
    console.log("Source filter:", fromAddress);
  }
  if (wallet) {
    args.to = wallet;
  }

  for (
    let fromBlock = startBlock;
    fromBlock < currentBlock;
    fromBlock += chunkSize
  ) {
    const toBlock =
      fromBlock + chunkSize - BigInt(1) > currentBlock
        ? currentBlock
        : fromBlock + chunkSize - BigInt(1);

    try {
      const request: Record<string, unknown> = {
        address: GLW_TOKEN,
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock,
      };

      if (Object.keys(args).length > 0) {
        request.args = args;
      }

      const logs = await client.getLogs(request as any);

      if (logs.length > 0) {
        allLogs.push(...logs);
        console.log(
          `  Found ${logs.length} GLW transfers in blocks ${fromBlock}-${toBlock}`
        );
      }
    } catch (error: any) {
      console.log(
        `  Error in blocks ${fromBlock}-${toBlock}:`,
        error.message?.substring(0, 80)
      );
    }
  }

  console.log(`Total GLW transfers fetched: ${allLogs.length}`);
  return allLogs;
}

interface HubFarmActivity {
  farmId: string;
  farmName: string | null;
  delegatorRewardsDistributed: string;
  minerRewardsDistributed: string;
  totalRewardsDistributed: string;
  uniqueDelegators: number;
  uniqueMiners: number;
  totalUniqueParticipants: number;
}

interface HubFarmSummary {
  weekRange: { startWeek: number; endWeek: number };
  summary: { totalFarms: number; returnedFarms: number };
  farms: HubFarmActivity[];
}

function printNetworkClaimSummary(claimData: ClaimData, startWeek: number) {
  console.log(
    `\n9. NETWORK-WIDE GLW CLAIM SUMMARY (on-chain, since week ${startWeek})`
  );
  console.log("-".repeat(70));

  const totalGlw = claimData.protocolTotal + claimData.inflationTotal;
  console.log(
    `Total GLW claimed across all wallets: ${formatGlw(totalGlw)} GLW`
  );
  console.log(
    `  - Protocol deposit GLW: ${formatGlw(claimData.protocolTotal)} GLW`
  );
  console.log(`  - Inflation GLW: ${formatGlw(claimData.inflationTotal)} GLW`);
  console.log(
    `Unique wallets with claims since week ${startWeek}: ${claimData.walletTotals.size}`
  );

  const leaderboard = Array.from(claimData.walletTotals.values())
    .slice()
    .sort((a, b) => b.totalGlw - a.totalGlw)
    .slice(0, 15)
    .map((entry) => ({
      wallet: shortAddress(entry.wallet),
      protocolGLW: formatNumber(entry.protocolGlw),
      inflationGLW: formatNumber(entry.inflationGlw),
      totalGLW: formatNumber(entry.totalGlw),
    }));

  if (leaderboard.length > 0) {
    console.log("\nTop wallets by GLW claimed:");
    console.table(leaderboard);
  } else {
    console.log("\nNo wallet claims found for the specified range.");
  }
}

async function printHubFarmSummary() {
  console.log("\n10. HUB API FARM SUMMARY (delegator GLW distribution)");
  console.log("-".repeat(70));

  try {
    const params = new URLSearchParams({ limit: "500", type: "delegator" });
    const response = await fetch(
      `${HUB_URL}/fractions/farms/activity?${params.toString()}`
    );

    if (!response.ok) {
      console.warn(
        "Failed to fetch farms activity:",
        response.status,
        await response.text()
      );
      return;
    }

    const data = (await response.json()) as HubFarmSummary;
    const totalDelegatorWei = data.farms.reduce(
      (acc, farm) => acc + toBigInt(farm.delegatorRewardsDistributed),
      BigInt(0)
    );

    console.log(
      `Week range: ${data.weekRange.startWeek} → ${data.weekRange.endWeek} (${data.summary.returnedFarms} farms)`
    );
    console.log(
      `Hub API reported delegator GLW: ${formatGlw(totalDelegatorWei)} GLW`
    );

    const farmPreview = data.farms
      .map((farm) => ({
        farm: farm.farmName ?? farm.farmId.slice(0, 8),
        delegatorGLW: Number(
          formatUnits(toBigInt(farm.delegatorRewardsDistributed), 18)
        ).toFixed(2),
        uniqueDelegators: farm.uniqueDelegators,
      }))
      .sort((a, b) => Number(b.delegatorGLW) - Number(a.delegatorGLW))
      .slice(0, 10);

    if (farmPreview.length > 0) {
      console.log("\nTop farms by delegator GLW (Hub API):");
      console.table(farmPreview);
    }
  } catch (error: any) {
    console.warn("Unable to fetch Hub farm summary:", error.message ?? error);
  }
}

async function analyzeNetworkActivity(
  claimData: ClaimData,
  swapAnalysis: SwapAnalysisResult
) {
  printSwapSummary(swapAnalysis);

  const participation = await fetchParticipationWallets();
  printParticipationSummary(participation, swapAnalysis);

  summarizeParticipationClaims(
    participation,
    claimData,
    swapAnalysis,
    START_WEEK
  );

  printNetworkClaimSummary(claimData, START_WEEK);
  await printHubFarmSummary();
}

async function main() {
  if (!SUMMARY_ONLY) {
    console.log("=".repeat(70));
    console.log("INSPECTING CLAIM FLOW FOR WALLET:", WALLET);
    console.log("=".repeat(70));

    // 1. Fetch Protocol Deposit claims (RewardClaimed events)
    console.log(
      "\n1. PROTOCOL DEPOSIT CLAIMS (on-chain RewardClaimed events):"
    );
    console.log("-".repeat(70));

    const protocolLogs = await fetchProtocolClaimEvents(WALLET);

    for (const log of protocolLogs) {
      const timestamp = await getBlockTimestamp(log.blockNumber);
      const nonce = log.args?.nonce;
      const week = nonce ? nonceToWeek(nonce) : "unknown";

      const taa = log.args?.taa || [];
      const amounts = taa.map((t: any) => ({
        token: t.token,
        amount: formatUnits(t.amount, 18),
      }));

      console.log({
        type: "RewardClaimed (Protocol Deposit)",
        week,
        nonce: nonce?.toString(),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber.toString(),
        timestamp: new Date(timestamp).toISOString(),
        timestampLocal: new Date(timestamp).toLocaleString(),
        tokensAndAmounts: amounts,
      });
    }

    // 2. Fetch GLW Transfers from MinerPool (inflation claims)
    console.log(
      "\n2. GLW INFLATION CLAIMS (on-chain Transfer events from MinerPool):"
    );
    console.log("-".repeat(70));

    const inflationLogs = await fetchGlwTransfers({ wallet: WALLET });

    for (const log of inflationLogs) {
      const timestamp = await getBlockTimestamp(log.blockNumber);
      const amount = log.args?.value ? formatUnits(log.args.value, 18) : "0";

      console.log({
        type: "GLW Transfer from MinerPool (Inflation Claim)",
        txHash: log.transactionHash,
        blockNumber: log.blockNumber.toString(),
        amount: `${amount} GLW`,
        timestamp: new Date(timestamp).toISOString(),
        timestampLocal: new Date(timestamp).toLocaleString(),
      });
    }

    // 3. Fetch delegation data from hub API
    console.log("\n3. FARM DELEGATION DATA (from hub API):");
    console.log("-".repeat(70));

    const res = await fetch(
      `${HUB_URL}/fractions/rewards-breakdown?walletAddress=${WALLET}`
    );
    const data = await res.json();

    console.log("\nFarm details with firstWeekWithRewards:");
    for (const farm of data.farmDetails || []) {
      const weekTs = weekToTimestamp(farm.firstWeekWithRewards);
      console.log({
        farmId: farm.farmId.substring(0, 16) + "...",
        type: farm.type,
        firstWeekWithRewards: farm.firstWeekWithRewards,
        firstWeekTimestamp: new Date(weekTs).toISOString(),
        firstWeekLocal: new Date(weekTs).toLocaleString(),
        amountInvested: formatUnits(toBigInt(farm.amountInvested), 18) + " GLW",
      });
    }

    console.log("\nWeek range:", data.weekRange);

    // 3b. Fetch ACTUAL delegation transaction timestamps from splits-activity API
    console.log(
      "\n3b. ACTUAL DELEGATION TRANSACTIONS (from splits-activity API):"
    );
    console.log("-".repeat(70));

    const splitsRes = await fetch(
      `${HUB_URL}/fractions/splits-activity?walletAddress=${WALLET}&limit=100`
    );
    const splitsData = await splitsRes.json();

    interface SplitActivity {
      transactionHash: string;
      timestamp: number;
      purchaseDate: string;
      stepsPurchased: number;
      amount: string;
      fractionType?: string;
      farmName: string;
      currency: string;
    }

    const splitsActivity: SplitActivity[] = splitsData.activity || [];

    console.log(
      `\nFound ${splitsActivity.length} delegation/purchase transactions:`
    );
    for (const split of splitsActivity) {
      const ts = split.timestamp * 1000; // Convert to ms
      const amountInGlw =
        split.currency === "GLW"
          ? formatUnits(toBigInt(split.amount), 18)
          : "N/A";

      console.log({
        txHash: split.transactionHash?.substring(0, 16) + "...",
        type: split.fractionType || "unknown",
        timestamp: new Date(ts).toISOString(),
        timestampLocal: new Date(ts).toLocaleString(),
        purchaseDate: split.purchaseDate,
        farmName: split.farmName?.substring(0, 20) || "N/A",
        stepsPurchased: split.stepsPurchased,
        currency: split.currency,
        amount: split.currency === "GLW" ? `${amountInGlw} GLW` : split.amount,
      });
    }

    // 4. Timeline comparison
    console.log("\n4. TIMELINE COMPARISON:");
    console.log("-".repeat(70));

    // Build claim events by actual timestamp
    interface ClaimEvent {
      type: string;
      week: number | string;
      timestamp: number;
      amount: string;
      txHash: string;
    }

    const claimEvents: ClaimEvent[] = [];

    // Add protocol claims
    for (const log of protocolLogs) {
      const timestamp = await getBlockTimestamp(log.blockNumber);
      const nonce = log.args?.nonce;
      const week = nonce ? nonceToWeek(nonce) : 0;
      const taa = log.args?.taa || [];
      const glwAmount = taa.find(
        (t: any) => t.token.toLowerCase() === GLW_TOKEN.toLowerCase()
      );
      const amount = glwAmount ? formatUnits(glwAmount.amount, 18) : "0";

      claimEvents.push({
        type: "Protocol Deposit",
        week,
        timestamp,
        amount: `${amount} GLW`,
        txHash: log.transactionHash,
      });
    }

    // Add inflation claims
    for (const log of inflationLogs) {
      const timestamp = await getBlockTimestamp(log.blockNumber);
      const amount = log.args?.value ? formatUnits(log.args.value, 18) : "0";

      claimEvents.push({
        type: "Inflation",
        week: "n/a",
        timestamp,
        amount: `${amount} GLW`,
        txHash: log.transactionHash,
      });
    }

    // Sort all events by timestamp
    claimEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Build delegation events from ACTUAL splits-activity timestamps
    interface DelegationEvent {
      type: string;
      timestamp: number;
      amount: string;
      txHash: string;
      farmName: string;
    }

    const delegationEvents: DelegationEvent[] = [];
    for (const split of splitsActivity) {
      if (split.fractionType !== "launchpad") continue;
      const amountGlw = formatUnits(toBigInt(split.amount), 18);
      delegationEvents.push({
        type: "Delegation (GLW)",
        timestamp: split.timestamp * 1000,
        amount: `${amountGlw} GLW`,
        txHash: split.transactionHash,
        farmName: split.farmName,
      });
    }

    // Sort delegations by actual timestamp
    delegationEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Combine all events for unified timeline
    const allEvents = [
      ...claimEvents.map((e) => ({
        timestamp: e.timestamp,
        type: e.type,
        detail: `Week ${e.week}`,
        amount: e.amount,
        txHash: e.txHash,
      })),
      ...delegationEvents.map((e) => ({
        timestamp: e.timestamp,
        type: e.type,
        detail: e.farmName?.substring(0, 20) || "Farm",
        amount: e.amount,
        txHash: e.txHash,
      })),
    ];

    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    console.log("\n--- UNIFIED TIMELINE (all events by actual timestamp) ---");
    for (const event of allEvents) {
      console.log(
        `  ${new Date(event.timestamp).toLocaleString()} | ${event.type.padEnd(
          20
        )} | ${event.detail.padEnd(15)} | ${event.amount.padEnd(
          25
        )} | tx: ${event.txHash.substring(0, 12)}...`
      );
    }

    console.log("\n--- CLAIMS ONLY (sorted by actual on-chain timestamp) ---");
    for (const event of claimEvents) {
      console.log(
        `  ${new Date(event.timestamp).toLocaleString()} | ${
          event.type
        } | Week ${event.week} | ${event.amount} | tx: ${event.txHash.substring(
          0,
          12
        )}...`
      );
    }

    console.log("\n--- DELEGATIONS ONLY (sorted by actual tx timestamp) ---");
    for (const event of delegationEvents) {
      console.log(
        `  ${new Date(
          event.timestamp
        ).toLocaleString()} | ${event.farmName?.substring(0, 20)} | ${
          event.amount
        } | tx: ${event.txHash.substring(0, 12)}...`
      );
    }

    // 5. Key insight
    console.log("\n5. KEY INSIGHT:");
    console.log("-".repeat(70));
    console.log(`
SOLUTION FOUND:

The splits-activity API (/fractions/splits-activity?walletAddress=...) returns
the ACTUAL delegation transaction timestamps!

Each SplitActivity has:
- transactionHash: The on-chain tx hash
- timestamp: Unix timestamp of the delegation transaction
- purchaseDate: ISO date string
- amount: Amount in wei
- fractionType: "launchpad" (GLW delegation) or "mining-center" (USDC miner purchase)

FIX FOR wallet-activity-kpis.tsx:
1. Fetch splits-activity for the wallet using the hub API
2. Use split.timestamp * 1000 for actual delegation timestamps
3. Replace the weekToTimestamp(firstWeekWithRewards) approach

The unified timeline above now shows all events in correct chronological order!
    `);
  } else {
    console.log(
      "\nSummary-only mode enabled. Skipping wallet-level inspection."
    );
  }

  let cachedPayload: CachePayload | null = null;
  if (CACHE_ENABLED && !REFRESH_CACHE) {
    cachedPayload = loadCachePayload(CACHE_FILE);
    if (cachedPayload && cachedPayload.startWeek !== START_WEEK) {
      console.warn(
        `Cache startWeek (${cachedPayload.startWeek}) does not match requested ${START_WEEK}. Ignoring cache.`
      );
      cachedPayload = null;
    } else if (cachedPayload) {
      console.log(`Loaded cached dataset from ${CACHE_FILE}`);
    }
  }

  const shouldRefreshCache = CACHE_ENABLED && (REFRESH_CACHE || !cachedPayload);

  const claimData =
    cachedPayload && !REFRESH_CACHE
      ? deserializeClaimData(cachedPayload.claims)
      : await buildClaimData(START_WEEK);

  const swapAnalysis =
    cachedPayload && !REFRESH_CACHE
      ? deserializeSwapAnalysis(cachedPayload.swaps)
      : await fetchRecentSwaps();

  if (CACHE_ENABLED && shouldRefreshCache) {
    const payload: CachePayload = {
      generatedAt: new Date().toISOString(),
      startWeek: START_WEEK,
      claims: serializeClaimData(claimData),
      swaps: serializeSwapAnalysis(swapAnalysis),
    };
    saveCachePayload(CACHE_FILE, payload);
  }

  await analyzeNetworkActivity(claimData, swapAnalysis);
}

main().catch(console.error);
