#!/usr/bin/env node

const DEFAULTS = {
  frontendBaseUrl: "https://app.glow.org",
  crmBaseUrl: "https://gca-crm-backend-production-1f2a.up.railway.app",
  controlBaseUrl: "https://api-prod-34ce.up.railway.app",
  ponderBaseUrl: "https://glow-ponder-listener-2-production.up.railway.app",
  timeoutMs: 20_000,
  wallets: [
    "0x5e230FED487c86B90f6508104149F087d9B1B0A7",
    "0x77f41144e787cb8cd29a37413a71f53f92ee050c",
  ],
  expectedLimits: {
    crmReady: 240,
    crmLaunchpad: 600,
    crmSplits: 360,
    crmAnalytics: 60,
    controlWallet: 600,
  },
};

function printHelp() {
  console.log(`Usage: node scripts/prod-sweep.mjs [options]

Read-only production health sweep for frontend + CRM + Control + Ponder.

Options:
  --frontendBaseUrl <url>      Frontend base URL
  --crmBaseUrl <url>           CRM base URL
  --controlBaseUrl <url>       Control base URL
  --ponderBaseUrl <url>        Ponder base URL
  --wallets <a,b,c>            Wallets to probe
  --timeoutMs <n>              Per-request timeout (default: ${DEFAULTS.timeoutMs})
  --withBrowser                Also run Playwright browser checks
  --json                       Print raw JSON summary
  --help                       Show this message

Examples:
  node scripts/prod-sweep.mjs
  node scripts/prod-sweep.mjs --withBrowser
  node scripts/prod-sweep.mjs --wallets 0xabc...,0xdef... --json
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
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

function parseUrl(value, fallback) {
  const raw = value ? String(value) : fallback;
  return new URL(raw).toString().replace(/\/$/, "");
}

function parseInteger(value, fallback, label) {
  if (value == null) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseWallets(value) {
  if (!value) return [...DEFAULTS.wallets];
  const wallets = String(value)
    .split(",")
    .map(wallet => wallet.trim())
    .filter(Boolean);
  if (!wallets.length) throw new Error("No wallets provided");
  return [...new Set(wallets)];
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = nowMs();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json, text/html;q=0.9,*/*;q=0.8",
        ...headers,
      },
      signal: controller.signal,
    });
    const bodyText = await response.text();
    const durationMs = nowMs() - startedAt;

    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      headers: response.headers,
      text: bodyText,
    };
  } catch (error) {
    const durationMs = nowMs() - startedAt;
    if (
      typeof error === "object" &&
      error != null &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw new Error(
      `Request failed for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson(url, timeoutMs, headers = {}) {
  const response = await fetchText(url, timeoutMs, headers);
  let body = null;
  try {
    body = response.text ? JSON.parse(response.text) : null;
  } catch {
    body = response.text;
  }
  return {
    ...response,
    body,
  };
}

function checkRateLimit(result, expected, name) {
  const raw = result.headers.get("x-ratelimit-limit");
  const limit = raw == null ? null : Number(raw);
  assert(
    limit === expected,
    `${name} x-ratelimit-limit=${raw ?? "missing"} instead of ${expected}`
  );
  return limit;
}

function formatMs(value) {
  return `${Math.round(value)}ms`;
}

async function runCrmChecks(config) {
  const checks = [
    {
      name: "ready",
      path: "/health/ready",
      expectedLimit: config.expectedLimits.crmReady,
      validate(body) {
        assert(body?.status === "ok", "CRM /health/ready status must be ok");
        assert(
          body?.controlApiConfigured === true,
          "CRM /health/ready controlApiConfigured must be true"
        );
      },
    },
    {
      name: "ready-deep",
      path: "/health/ready-deep",
      expectedLimit: config.expectedLimits.crmReady,
      validate(body) {
        assert(body?.status === "ok", "CRM /health/ready-deep status must be ok");
        assert(
          body?.probes?.controlHoldersCount?.ok === true,
          "CRM ready-deep controlHoldersCount probe must be ok"
        );
        assert(
          body?.probes?.ponderHealth?.ok === true,
          "CRM ready-deep ponderHealth probe must be ok"
        );
        assert(
          body?.probes?.ponderClaimsBatch?.ok === true,
          "CRM ready-deep ponderClaimsBatch probe must be ok"
        );
      },
    },
    {
      name: "live-soon",
      path: "/applications/live-soon",
      expectedLimit: config.expectedLimits.crmLaunchpad,
      validate(body) {
        assert(body && typeof body === "object", "CRM live-soon must return an object");
        assert(Array.isArray(body.farms), "CRM live-soon must include farms[]");
      },
    },
    {
      name: "launchpad-listings",
      path: "/applications/sponsor-listings-applications?type=launchpad",
      expectedLimit: config.expectedLimits.crmLaunchpad,
      validate(body) {
        assert(Array.isArray(body), "CRM sponsor-listings must return an array");
      },
    },
    {
      name: "splits-activity",
      path: "/fractions/splits-activity?limit=10",
      expectedLimit: config.expectedLimits.crmSplits,
      validate(body) {
        assert(body && typeof body === "object", "CRM splits activity body must be object");
        assert(Array.isArray(body.activity), "CRM splits activity must include activity[]");
      },
    },
    {
      name: "splits-activity-by-type",
      path: "/fractions/splits-activity-by-type?fractionType=launchpad&limit=10",
      expectedLimit: config.expectedLimits.crmSplits,
      validate(body) {
        assert(body && typeof body === "object", "CRM splits-by-type body must be object");
        assert(Array.isArray(body.activity), "CRM splits-by-type must include activity[]");
      },
    },
    {
      name: "wallet-stats",
      path: "/impact/wallet-stats?walletAddress=0x5e230FED487c86B90f6508104149F087d9B1B0A7",
      expectedLimit: config.expectedLimits.crmAnalytics,
      validate(body) {
        assert(body && typeof body === "object", "CRM wallet-stats must return an object");
      },
    },
    {
      name: "glow-score-leaderboard",
      path: "/impact/glow-score?limit=10&sort=totalPoints&dir=desc",
      expectedLimit: config.expectedLimits.crmAnalytics,
      validate(body) {
        assert(body && typeof body === "object", "CRM glow-score must return an object");
        assert(Array.isArray(body.wallets), "CRM glow-score must include wallets[]");
      },
    },
    {
      name: "fraction-event-jobs",
      path: "/health/fraction-event-jobs",
      validate(body) {
        assert(body && typeof body === "object", "CRM fraction-event-jobs must return an object");
      },
    },
  ];

  const results = [];
  for (const check of checks) {
    const url = `${config.crmBaseUrl}${check.path}`;
    const result = await fetchJson(url, config.timeoutMs);
    assert(result.status === 200, `CRM ${check.name} returned ${result.status}`);
    const limit =
      check.expectedLimit == null
        ? null
        : checkRateLimit(result, check.expectedLimit, `CRM ${check.name}`);
    check.validate?.(result.body);
    results.push({
      name: check.name,
      url,
      status: result.status,
      durationMs: result.durationMs,
      rateLimit: limit,
    });
  }

  return results;
}

async function runControlChecks(config) {
  const results = [];

  for (const wallet of config.wallets) {
    const paths = [
      { name: "wallet", path: `/wallets/address/${wallet}` },
      {
        name: "weekly-rewards",
        path: `/wallets/address/${wallet}/weekly-rewards?limit=10&endWeek=124`,
      },
      {
        name: "minted-events",
        path: `/wallets/address/${wallet}/events/minted?limit=10`,
      },
      {
        name: "stake-events",
        path: `/wallets/address/${wallet}/events/stake?limit=10`,
      },
    ];

    for (const check of paths) {
      const url = `${config.controlBaseUrl}${check.path}`;
      const result = await fetchJson(url, config.timeoutMs);
      assert(
        result.status === 200,
        `Control ${check.name} for ${wallet} returned ${result.status}`
      );
      const limit = checkRateLimit(
        result,
        config.expectedLimits.controlWallet,
        `Control ${check.name}`
      );
      results.push({
        wallet,
        name: check.name,
        url,
        status: result.status,
        durationMs: result.durationMs,
        rateLimit: limit,
      });
    }
  }

  const safeExecUrl = `${config.controlBaseUrl}/weekly-rewards-safe-execution-check`;
  const safeExec = await fetchJson(safeExecUrl, config.timeoutMs);
  assert(
    safeExec.status === 200,
    `Control weekly-rewards-safe-execution-check returned ${safeExec.status}`
  );
  results.push({
    name: "weekly-rewards-safe-execution-check",
    url: safeExecUrl,
    status: safeExec.status,
    durationMs: safeExec.durationMs,
    rateLimit: null,
  });

  return results;
}

async function runPonderChecks(config) {
  const results = [];

  const healthUrl = `${config.ponderBaseUrl}/health`;
  const health = await fetchJson(healthUrl, config.timeoutMs);
  assert(health.status === 200, `Ponder /health returned ${health.status}`);
  results.push({
    name: "health",
    url: healthUrl,
    status: health.status,
    durationMs: health.durationMs,
  });

  for (const wallet of config.wallets) {
    const paths = [
      {
        name: "claims",
        path: `/rewards/claims/${wallet}?limit=100`,
      },
      {
        name: "swap-activity",
        path: `/get-wallet-swap-activity/${wallet}?limit=100`,
      },
    ];

    for (const check of paths) {
      const url = `${config.ponderBaseUrl}${check.path}`;
      const result = await fetchJson(url, config.timeoutMs);
      assert(
        result.status === 200,
        `Ponder ${check.name} for ${wallet} returned ${result.status}`
      );
      results.push({
        wallet,
        name: check.name,
        url,
        status: result.status,
        durationMs: result.durationMs,
      });
    }
  }

  return results;
}

function normalizeImpactText(text) {
  return text.replace(/\s*pts$/i, "").trim();
}

async function runBrowserChecks(config) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is not installed. Install it first or omit --withBrowser. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const checks = [];

  try {
    const basePages = ["/", "/launchpad", "/leaderboard"];
    for (const path of basePages) {
      const url = `${config.frontendBaseUrl}${path}`;
      const failures = [];
      const consoleErrors = [];
      page.removeAllListeners("requestfailed");
      page.removeAllListeners("console");
      page.on("requestfailed", request => {
        failures.push({
          url: request.url(),
          error: request.failure()?.errorText ?? "request failed",
        });
      });
      page.on("console", message => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      const startedAt = nowMs();
      await page.goto(url, { waitUntil: "networkidle", timeout: config.timeoutMs });
      const durationMs = nowMs() - startedAt;
      const release = await page.evaluate(() => {
        const sentryTag = document.querySelector(
          'meta[name="sentry-release"], meta[property="sentry-release"]'
        );
        return sentryTag?.getAttribute("content") ?? null;
      });
      checks.push({
        url,
        title: await page.title(),
        durationMs,
        release,
        failures,
        consoleErrors,
      });
    }

    for (const wallet of config.wallets) {
      const url = `${config.frontendBaseUrl}/wallet/${wallet}`;
      const failures = [];
      const consoleErrors = [];
      page.removeAllListeners("requestfailed");
      page.removeAllListeners("console");
      page.on("requestfailed", request => {
        failures.push({
          url: request.url(),
          error: request.failure()?.errorText ?? "request failed",
        });
      });
      page.on("console", message => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      const startedAt = nowMs();
      await page.goto(url, { waitUntil: "networkidle", timeout: config.timeoutMs });
      const durationMs = nowMs() - startedAt;

      await page.getByRole("button", { name: /breakdown/i }).first().click();
      await page.waitForTimeout(300);
      const cardText = await page.locator("text=/\\d[\\d,]* pts/").first().textContent();
      const dialogText = await page.locator("text=/current impact/i").locator("..").locator("text=/\\d[\\d,]*/").first().textContent();
      const release = await page.evaluate(() => {
        const sentryTag = document.querySelector(
          'meta[name="sentry-release"], meta[property="sentry-release"]'
        );
        return sentryTag?.getAttribute("content") ?? null;
      });
      const normalizedCard = normalizeImpactText(cardText ?? "");
      const normalizedDialog = normalizeImpactText(dialogText ?? "");

      checks.push({
        url,
        title: await page.title(),
        durationMs,
        release,
        failures,
        consoleErrors,
        cardText,
        dialogText,
        totalsMatch: normalizedCard === normalizedDialog,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return checks;
}

function summarizeSection(name, results) {
  const maxMs = Math.max(...results.map(result => result.durationMs));
  return {
    name,
    checks: results.length,
    slowestMs: maxMs,
  };
}

function printHumanSummary(summary) {
  console.log("\nProd sweep summary\n");

  for (const section of ["crm", "control", "ponder"]) {
    const data = summary[section];
    const overview = summarizeSection(section, data);
    console.log(
      `${section.toUpperCase()}: ${overview.checks} checks, slowest ${formatMs(
        overview.slowestMs
      )}`
    );
    for (const item of data) {
      const rateLimit =
        item.rateLimit == null ? "" : `, limit ${item.rateLimit}`;
      const wallet = item.wallet ? `, wallet ${item.wallet.slice(0, 10)}...` : "";
      console.log(
        `  - ${item.name}: ${item.status} in ${formatMs(item.durationMs)}${rateLimit}${wallet}`
      );
    }
    console.log("");
  }

  if (summary.browser) {
    console.log(`BROWSER: ${summary.browser.length} pages checked`);
    for (const item of summary.browser) {
      const match =
        item.totalsMatch == null ? "" : `, totalsMatch=${item.totalsMatch}`;
      const failures = item.failures?.length ? `, failures=${item.failures.length}` : "";
      const consoleErrors = item.consoleErrors?.length
        ? `, consoleErrors=${item.consoleErrors.length}`
        : "";
      console.log(
        `  - ${item.url}: ${formatMs(item.durationMs)}${match}${failures}${consoleErrors}`
      );
    }
    console.log("");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const config = {
    frontendBaseUrl: parseUrl(args.frontendBaseUrl, DEFAULTS.frontendBaseUrl),
    crmBaseUrl: parseUrl(args.crmBaseUrl, DEFAULTS.crmBaseUrl),
    controlBaseUrl: parseUrl(args.controlBaseUrl, DEFAULTS.controlBaseUrl),
    ponderBaseUrl: parseUrl(args.ponderBaseUrl, DEFAULTS.ponderBaseUrl),
    timeoutMs: parseInteger(args.timeoutMs, DEFAULTS.timeoutMs, "--timeoutMs"),
    wallets: parseWallets(args.wallets),
    withBrowser: Boolean(args.withBrowser),
    json: Boolean(args.json),
    expectedLimits: { ...DEFAULTS.expectedLimits },
  };

  const summary = {
    startedAt: new Date().toISOString(),
    config: {
      frontendBaseUrl: config.frontendBaseUrl,
      crmBaseUrl: config.crmBaseUrl,
      controlBaseUrl: config.controlBaseUrl,
      ponderBaseUrl: config.ponderBaseUrl,
      timeoutMs: config.timeoutMs,
      wallets: config.wallets,
      withBrowser: config.withBrowser,
    },
    crm: await runCrmChecks(config),
    control: await runControlChecks(config),
    ponder: await runPonderChecks(config),
  };

  if (config.withBrowser) {
    summary.browser = await runBrowserChecks(config);
  }

  if (config.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printHumanSummary(summary);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
