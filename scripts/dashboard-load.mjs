#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONCURRENCY = 100;
const DEFAULT_CLIENT_COUNT = 100;
const DEFAULT_DURATION_SECONDS = 60;
const DEFAULT_WARMUP_SECONDS = 5;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RELOAD_PAUSE_MS = 250;
const DEFAULT_CLAIMS_LIMIT = 5000;
const DEFAULT_WEEK_WINDOW = 12;
const PROD_ACK = "prod-read-only";

function printHelp() {
  console.log(`Usage: node scripts/dashboard-load.mjs --baseUrl <url> [options]

Simulate hundreds of users loading the frontend dashboard at once and reloading
the launchpad/dashboard data bundle.

Required:
  --baseUrl <url>              Frontend base URL, e.g. https://staging.example.com

Wallet selection:
  --wallet <address>           Single wallet to reuse
  --wallets <a,b,c>            Comma-separated wallet pool
  --walletFile <path>          File with one wallet address per line

Optional traffic shape:
  --mode <mode>                page-load | api-reload | dashboard (default: dashboard)
  --concurrency <n>            Parallel workers (default: ${DEFAULT_CONCURRENCY})
  --clientCount <n>            Synthetic user/IP count (default: ${DEFAULT_CLIENT_COUNT})
  --durationSeconds <n>        Timed run length after warmup (default: ${DEFAULT_DURATION_SECONDS})
  --warmupSeconds <n>          Warmup before measured window (default: ${DEFAULT_WARMUP_SECONDS})
  --timeoutMs <n>              Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --reloadPauseMs <n>          Delay between reload cycles per worker (default: ${DEFAULT_RELOAD_PAUSE_MS})

Optional route inputs:
  --pagePathTemplate <path>    Path template with {wallet} (default: /wallet/{wallet})
  --launchpadType <type>       launchpad filter for sponsor listings (default: launchpad)
  --splitsLimit <n>            splits activity limit (default: 50)
  --weekWindow <n>             Weeks back for glow-score/glow-worth (default: ${DEFAULT_WEEK_WINDOW})

Optional direct browser-origin traffic:
  --hubBaseUrl <url>           Direct hub base URL for referral/status
  --positionsBaseUrl <url>     Direct positions API base URL for wallet claims
  --includeDirectPositionsClaims
                               Also hit positions API claims directly (off by default)
  --skipPage                   Do not include HTML page load in dashboard mode
  --skipReferral               Do not include direct /referral/status in dashboard mode
  --skipClaims                 Do not include direct positions claims in dashboard mode
  --skipGlowWorth              Do not include /api/impact/glow-worth in dashboard mode

Safety:
  DASHBOARD_LOAD_ACK=${PROD_ACK} is required when --baseUrl looks like production.

Examples:
  node scripts/dashboard-load.mjs \\
    --baseUrl https://glow-staging.example.com \\
    --walletFile ./tmp/wallets.txt \\
    --mode dashboard \\
    --concurrency 200 \\
    --clientCount 300

  DASHBOARD_LOAD_ACK=${PROD_ACK} node scripts/dashboard-load.mjs \\
    --baseUrl https://app.glow.org \\
    --wallets 0xabc...,0xdef... \\
    --hubBaseUrl https://crm.example.com \\
    --positionsBaseUrl https://ponder-listener.example.com
`);
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;

    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function parseInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseBaseUrl(value) {
  if (!value) throw new Error("--baseUrl is required");
  const url = new URL(String(value));
  return url.toString().replace(/\/$/, "");
}

function maybeParseUrl(value) {
  if (!value) return null;
  return new URL(String(value)).toString().replace(/\/$/, "");
}

function loadWallets(args) {
  const wallets = [];

  if (args.wallet) wallets.push(String(args.wallet).trim());

  if (args.wallets) {
    for (const entry of String(args.wallets).split(",")) {
      const trimmed = entry.trim();
      if (trimmed) wallets.push(trimmed);
    }
  }

  if (args.walletFile) {
    const filePath = path.resolve(String(args.walletFile));
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      wallets.push(trimmed);
    }
  }

  return [...new Set(wallets.map(wallet => wallet.toLowerCase()))];
}

function looksLikeProduction(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.includes("staging")) return false;
  if (hostname.includes("preview")) return false;
  if (hostname.endsWith(".local")) return false;
  return true;
}

function requireAckIfNeeded(baseUrl) {
  if (!looksLikeProduction(baseUrl)) return;
  if (process.env.DASHBOARD_LOAD_ACK === PROD_ACK) return;
  throw new Error(
    `Refusing to run against ${baseUrl} without DASHBOARD_LOAD_ACK=${PROD_ACK}`
  );
}

function buildSyntheticIp(index) {
  const octet2 = Math.floor(index / (255 * 255)) % 255;
  const octet3 = Math.floor(index / 255) % 255;
  const octet4 = index % 255;
  return `198.${octet2}.${octet3}.${Math.max(1, octet4)}`;
}

function pickFromList(list, index, fallback = null) {
  if (!list.length) return fallback;
  return list[index % list.length];
}

function quantile(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rawIndex = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );
  return sorted[rawIndex];
}

function formatMs(value) {
  if (value == null) return "n/a";
  return `${Math.round(value)}ms`;
}

function formatPct(numerator, denominator) {
  if (!denominator) return "0.00%";
  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function nowMs() {
  return performance.now();
}

async function fetchJson(url, requestInit, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = nowMs();

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
    });
    const durationMs = nowMs() - startedAt;
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      headers: response.headers,
      text,
      payload,
    };
  } catch (error) {
    const durationMs = nowMs() - startedAt;
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    return {
      ok: false,
      status: "error",
      durationMs,
      headers: new Headers(),
      text: message,
      payload: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getCurrentWeekNumber() {
  const START_MS = Date.UTC(2023, 7, 7, 0, 0, 0, 0);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const elapsedWeeks = Math.floor((Date.now() - START_MS) / WEEK_MS);
  return Math.max(0, elapsedWeeks);
}

function buildTargetPlan(options) {
  const currentWeek = getCurrentWeekNumber();
  const endWeek = currentWeek;
  const startWeek = Math.max(0, endWeek - options.weekWindow);
  const targets = [];

  if (options.mode === "page-load" || options.mode === "dashboard") {
    if (!options.skipPage) {
      targets.push({
        name: "page-wallet",
        type: "page",
        buildPath: ({ wallet }) =>
          options.pagePathTemplate.replaceAll("{wallet}", encodeURIComponent(wallet)),
      });
    }
  }

  if (options.mode === "api-reload" || options.mode === "dashboard") {
    targets.push(
      {
        name: "next-launchpad-listings",
        type: "next",
        buildPath: () =>
          `/api/applications/sponsor-listings-applications?type=${encodeURIComponent(options.launchpadType)}`,
      },
      {
        name: "next-splits-activity",
        type: "next",
        buildPath: () => `/api/fractions/splits-activity?limit=${options.splitsLimit}`,
      },
      {
        name: "next-splits-activity-by-type",
        type: "next",
        buildPath: () =>
          `/api/fractions/splits-activity-by-type?fractionType=${encodeURIComponent(options.launchpadType)}&limit=${options.splitsLimit}`,
      },
      {
        name: "next-impact-glow-score",
        type: "next",
        buildPath: ({ wallet }) =>
          `/api/impact/glow-score?walletAddress=${encodeURIComponent(wallet)}&startWeek=${startWeek}&endWeek=${endWeek}&includeWeekly=0&includeProjection=1&includeReferral=1`,
      },
      {
        name: "next-impact-wallet-stats",
        type: "next",
        buildPath: () => "/api/impact/wallet-stats",
      }
    );

    if (!options.skipGlowWorth) {
      targets.push({
        name: "next-impact-glow-worth",
        type: "next",
        buildPath: ({ wallet }) =>
          `/api/impact/glow-worth?walletAddress=${encodeURIComponent(wallet)}&startWeek=${startWeek}&endWeek=${endWeek}`,
      });
    }

    if (options.hubBaseUrl && !options.skipReferral) {
      targets.push({
        name: "hub-referral-status",
        type: "hub",
        buildPath: ({ wallet }) =>
          `/referral/status?walletAddress=${encodeURIComponent(wallet)}`,
      });
    }

    if (
      options.positionsBaseUrl &&
      !options.skipClaims &&
      options.includeDirectPositionsClaims
    ) {
      targets.push({
        name: "positions-wallet-claims",
        type: "positions",
        buildPath: ({ wallet }) =>
          `/rewards/claims/${encodeURIComponent(wallet.toLowerCase())}?limit=${DEFAULT_CLAIMS_LIMIT}`,
      });
    }
  }

  return { startWeek, endWeek, targets };
}

function buildRequestForTarget(target, session, options) {
  let baseUrl = options.baseUrl;
  if (target.type === "hub") baseUrl = options.hubBaseUrl;
  if (target.type === "positions") baseUrl = options.positionsBaseUrl;
  if (!baseUrl) throw new Error(`Missing base URL for target ${target.name}`);

  const url = new URL(target.buildPath(session), baseUrl);
  const headers = new Headers({
    "user-agent": `dashboard-load/1.0 client-${session.clientId}`,
    "x-forwarded-for": session.ipAddress,
    "cf-connecting-ip": session.ipAddress,
    "x-real-ip": session.ipAddress,
    "x-dashboard-load-client-id": String(session.clientId),
    "cache-control": "no-cache",
  });

  return { url: url.toString(), headers };
}

function createSession(clientId, wallets) {
  const wallet = pickFromList(wallets, clientId);
  return {
    clientId,
    wallet,
    ipAddress: buildSyntheticIp(clientId + 1),
  };
}

function ensureWalletsIfNeeded(mode, wallets) {
  if (mode === "api-reload" || mode === "dashboard" || mode === "page-load") {
    if (!wallets.length) {
      throw new Error(
        "At least one wallet is required. Pass --wallet, --wallets, or --walletFile."
      );
    }
  }
}

function createStatsBucket(name) {
  return {
    name,
    attempts: 0,
    failures: 0,
    durations: [],
    statusCounts: new Map(),
    rateLimitBuckets: new Set(),
    sampleErrors: [],
  };
}

function recordResult(bucket, result) {
  bucket.attempts += 1;
  bucket.durations.push(result.durationMs);

  const statusKey = String(result.status);
  bucket.statusCounts.set(statusKey, (bucket.statusCounts.get(statusKey) ?? 0) + 1);

  const rateBucket =
    result.headers.get("x-ratelimit-limit") ??
    result.headers.get("ratelimit-limit") ??
    result.headers.get("x-ratelimit-policy");
  if (rateBucket) bucket.rateLimitBuckets.add(rateBucket);

  if (!result.ok) {
    bucket.failures += 1;
    if (bucket.sampleErrors.length < 3) {
      bucket.sampleErrors.push(
        typeof result.text === "string" ? result.text.slice(0, 240) : "Request failed"
      );
    }
  }
}

function summarizeBucket(bucket) {
  return {
    attempts: bucket.attempts,
    failures: bucket.failures,
    errorRate: formatPct(bucket.failures, bucket.attempts),
    p50: formatMs(quantile(bucket.durations, 50)),
    p95: formatMs(quantile(bucket.durations, 95)),
    p99: formatMs(quantile(bucket.durations, 99)),
    max: formatMs(bucket.durations.length ? Math.max(...bucket.durations) : null),
    statuses: Object.fromEntries([...bucket.statusCounts.entries()].sort()),
    rateLimitBuckets: [...bucket.rateLimitBuckets].sort(),
    sampleErrors: bucket.sampleErrors,
  };
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function runPhase(label, durationMs, options, targets, wallets) {
  const phaseStart = Date.now();
  const phaseEnd = phaseStart + durationMs;
  const buckets = new Map(targets.map(target => [target.name, createStatsBucket(target.name)]));
  let overallAttempts = 0;

  const worker = async workerIndex => {
    const session = createSession(workerIndex % options.clientCount, wallets);

    while (Date.now() < phaseEnd) {
      for (const target of targets) {
        if (Date.now() >= phaseEnd) break;

        const request = buildRequestForTarget(target, session, options);
        const result = await fetchJson(
          request.url,
          { headers: request.headers },
          options.timeoutMs
        );

        overallAttempts += 1;
        recordResult(buckets.get(target.name), result);
      }

      if (options.reloadPauseMs > 0 && Date.now() < phaseEnd) {
        await sleep(options.reloadPauseMs);
      }
    }
  };

  await Promise.all(
    Array.from({ length: options.concurrency }, (_, index) => worker(index))
  );

  const elapsedMs = Date.now() - phaseStart;
  return {
    label,
    elapsedMs,
    overallAttempts,
    requestsPerSecond: elapsedMs > 0 ? overallAttempts / (elapsedMs / 1000) : 0,
    buckets,
  };
}

function printPhaseSummary(summary) {
  console.log(`\n${summary.label.toUpperCase()} SUMMARY`);
  console.log(`  elapsed: ${Math.round(summary.elapsedMs / 1000)}s`);
  console.log(`  overall attempts: ${summary.overallAttempts}`);
  console.log(`  requests/sec: ${summary.requestsPerSecond.toFixed(2)}`);

  for (const [name, bucket] of summary.buckets.entries()) {
    const data = summarizeBucket(bucket);
    console.log(`\n  ${name}`);
    console.log(`    attempts: ${data.attempts}`);
    console.log(`    failures: ${data.failures} (${data.errorRate})`);
    console.log(`    p50 / p95 / p99 / max: ${data.p50} / ${data.p95} / ${data.p99} / ${data.max}`);
    console.log(`    statuses: ${JSON.stringify(data.statuses)}`);
    if (data.rateLimitBuckets.length) {
      console.log(`    rateLimitBuckets: ${data.rateLimitBuckets.join(", ")}`);
    }
    if (data.sampleErrors.length) {
      console.log(`    sampleErrors: ${JSON.stringify(data.sampleErrors)}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    return;
  }

  const options = {
    baseUrl: parseBaseUrl(args.baseUrl),
    hubBaseUrl: maybeParseUrl(args.hubBaseUrl),
    positionsBaseUrl: maybeParseUrl(args.positionsBaseUrl),
    mode: String(args.mode ?? "dashboard"),
    concurrency: parseInteger(args.concurrency, DEFAULT_CONCURRENCY, "concurrency"),
    clientCount: parseInteger(args.clientCount, DEFAULT_CLIENT_COUNT, "clientCount"),
    durationSeconds: parseInteger(
      args.durationSeconds,
      DEFAULT_DURATION_SECONDS,
      "durationSeconds"
    ),
    warmupSeconds: parseInteger(
      args.warmupSeconds,
      DEFAULT_WARMUP_SECONDS,
      "warmupSeconds"
    ),
    timeoutMs: parseInteger(args.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs"),
    reloadPauseMs: parseInteger(
      args.reloadPauseMs,
      DEFAULT_RELOAD_PAUSE_MS,
      "reloadPauseMs"
    ),
    pagePathTemplate: String(args.pagePathTemplate ?? "/wallet/{wallet}"),
    launchpadType: String(args.launchpadType ?? "launchpad"),
    splitsLimit: parseInteger(args.splitsLimit, 50, "splitsLimit"),
    weekWindow: parseInteger(args.weekWindow, DEFAULT_WEEK_WINDOW, "weekWindow"),
    skipPage: Boolean(args.skipPage),
    skipReferral: Boolean(args.skipReferral),
    skipClaims: Boolean(args.skipClaims),
    skipGlowWorth: Boolean(args.skipGlowWorth),
    includeDirectPositionsClaims: Boolean(args.includeDirectPositionsClaims),
  };

  if (!["page-load", "api-reload", "dashboard"].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  requireAckIfNeeded(options.baseUrl);

  const wallets = loadWallets(args);
  ensureWalletsIfNeeded(options.mode, wallets);

  const plan = buildTargetPlan(options);
  if (!plan.targets.length) {
    throw new Error("No targets were selected for this run.");
  }

  console.log("Dashboard load test plan");
  console.log(`  baseUrl: ${options.baseUrl}`);
  if (options.hubBaseUrl) console.log(`  hubBaseUrl: ${options.hubBaseUrl}`);
  if (options.positionsBaseUrl) {
    console.log(`  positionsBaseUrl: ${options.positionsBaseUrl}`);
  }
  console.log(`  mode: ${options.mode}`);
  console.log(`  concurrency: ${options.concurrency}`);
  console.log(`  clientCount: ${options.clientCount}`);
  console.log(`  warmupSeconds: ${options.warmupSeconds}`);
  console.log(`  durationSeconds: ${options.durationSeconds}`);
  console.log(`  wallets: ${wallets.length}`);
  console.log(`  impactWeekRange: ${plan.startWeek} -> ${plan.endWeek}`);
  console.log(`  targets: ${plan.targets.map(target => target.name).join(", ")}`);

  const warmup = await runPhase(
    "warmup",
    options.warmupSeconds * 1000,
    options,
    plan.targets,
    wallets
  );
  printPhaseSummary(warmup);

  const measured = await runPhase(
    "measured",
    options.durationSeconds * 1000,
    options,
    plan.targets,
    wallets
  );
  printPhaseSummary(measured);
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : String(error ?? "Unknown error")
  );
  process.exitCode = 1;
});
