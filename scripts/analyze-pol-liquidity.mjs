#!/usr/bin/env node
/**
 * Analyze PoL liquidity snapshots and explain why the 12w chart can go down.
 *
 * Data source: Ponder `/pol/snapshots` (same endpoint proxied by
 * `app/api/pol-liquidity-snapshot/route.ts`).
 *
 * Usage:
 *   node scripts/analyze-pol-liquidity.mjs
 *   node scripts/analyze-pol-liquidity.mjs --range=12w
 *   node scripts/analyze-pol-liquidity.mjs --base=https://glow-ponder-listener-2-production.up.railway.app
 *
 * Notes:
 * - `pol_lq` is not guaranteed to be monotonic. It can decrease if reserves
 *   decrease (liquidity removed, rebalancing, etc).
 * - Endpoint currently returns only total PoL (no per-source endowment vs botActive
 *   weekly split), so this script focuses on reserves + deltas.
 */

const DEFAULT_PONDER_BASE =
  process.env.NEXT_PUBLIC_POSITIONS_API_BASE ||
  "https://glow-ponder-listener-2-production.up.railway.app";

function parseArgs(argv) {
  const out = { range: "12w", base: DEFAULT_PONDER_BASE };
  for (const a of argv.slice(2)) {
    if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("--range=")) out.range = a.slice("--range=".length);
    else if (a.startsWith("--base=")) out.base = a.slice("--base=".length);
  }
  return out;
}

function formatUnitsBigInt(raw, decimals) {
  const negative = raw < 0n;
  const n = negative ? -raw : raw;
  const s = n.toString();
  if (decimals === 0) return (negative ? "-" : "") + s;
  const pad = s.padStart(decimals + 1, "0");
  const intPart = pad.slice(0, -decimals);
  const fracPart = pad.slice(-decimals).replace(/0+$/g, "");
  return (
    (negative ? "-" : "") + intPart + (fracPart ? `.${fracPart}` : "")
  );
}

function toNumberSafe(str) {
  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}

function fmtCompact(n, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(n);
}

function fmtSigned(n, suffix = "") {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${fmtCompact(Math.abs(n))}${suffix}`;
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function sqrtFloat(x) {
  if (!Number.isFinite(x) || x < 0) return NaN;
  return Math.sqrt(x);
}

async function main() {
  const { help, range, base } = parseArgs(process.argv);
  if (help) {
    console.log(
      [
        "Analyze PoL liquidity snapshots.",
        "",
        "Usage:",
        "  node scripts/analyze-pol-liquidity.mjs [--range=12w] [--base=https://...]",
        "",
        `Defaults: --range=12w --base=${DEFAULT_PONDER_BASE}`,
      ].join("\n")
    );
    process.exit(0);
  }

  const url = new URL("/pol/snapshots", base);
  url.searchParams.set("range", range);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Request failed: ${res.status} ${res.statusText}`);
    console.error(text.slice(0, 400));
    process.exit(1);
  }

  const payload = await res.json();
  const series = Array.isArray(payload?.series) ? payload.series : [];
  if (!series.length) {
    console.log("No series data returned.");
    process.exit(0);
  }

  const rows = series
    .slice()
    .sort((a, b) => Number(a.week) - Number(b.week))
    .map((r) => {
      const usdgAtomic = BigInt(r.pol_usdg);
      const glwAtomic = BigInt(r.pol_glw);
      const lqAtomic = BigInt(r.pol_lq);

      const usdg = toNumberSafe(formatUnitsBigInt(usdgAtomic, 6));
      const glw = toNumberSafe(formatUnitsBigInt(glwAtomic, 18));
      const lq = toNumberSafe(formatUnitsBigInt(lqAtomic, 12));

      const price = glw > 0 ? usdg / glw : NaN; // USDG per GLW, implied by reserves
      const sqrtK = sqrtFloat(usdg * glw); // tokens-space sqrt product (for intuition)

      return {
        week: Number(r.week),
        usdg,
        glw,
        lq,
        price,
        sqrtK,
      };
    });

  const withDeltas = rows.map((r, idx) => {
    const prev = idx > 0 ? rows[idx - 1] : null;
    const deltaUsdg = prev ? r.usdg - prev.usdg : NaN;
    const deltaGlw = prev ? r.glw - prev.glw : NaN;
    const deltaLq = prev ? r.lq - prev.lq : NaN;
    const deltaPrice = prev ? r.price - prev.price : NaN;

    const pctLq = prev && prev.lq ? deltaLq / prev.lq : NaN;
    const pctUsdg = prev && prev.usdg ? deltaUsdg / prev.usdg : NaN;
    const pctGlw = prev && prev.glw ? deltaGlw / prev.glw : NaN;

    return {
      ...r,
      deltaUsdg,
      deltaGlw,
      deltaLq,
      deltaPrice,
      pctLq,
      pctUsdg,
      pctGlw,
    };
  });

  const downWeeks = withDeltas.filter((r) => Number.isFinite(r.deltaLq) && r.deltaLq < 0);

  console.log(`PoL snapshots: ${url.toString()}`);
  console.log(
    `Weeks: ${payload?.weekRange?.startWeek ?? "?"} → ${
      payload?.weekRange?.endWeek ?? "?"
    } (${series.length} rows)`
  );
  console.log("");

  const header = [
    "week",
    "lq",
    "Δlq",
    "Δlq%",
    "usdg",
    "Δusdg%",
    "glw",
    "Δglw%",
    "price",
    "Δprice",
  ];
  console.log(header.join("\t"));

  for (const r of withDeltas) {
    const line = [
      `W${r.week}`,
      `${fmtCompact(r.lq, 2)} lq`,
      `${fmtSigned(r.deltaLq, " lq")}`,
      `${fmtPct(r.pctLq)}`,
      `$${fmtCompact(r.usdg, 2)}`,
      `${fmtPct(r.pctUsdg)}`,
      `${fmtCompact(r.glw, 2)}`,
      `${fmtPct(r.pctGlw)}`,
      `$${Number.isFinite(r.price) ? r.price.toFixed(4) : "—"}`,
      `${Number.isFinite(r.deltaPrice) ? (r.deltaPrice >= 0 ? "+" : "") + r.deltaPrice.toFixed(4) : "—"}`,
    ];
    console.log(line.join("\t"));
  }

  console.log("");
  console.log(
    `Down weeks: ${downWeeks.length}/${withDeltas.length - 1} (weeks where pol_lq decreased vs prior)`
  );

  if (downWeeks.length) {
    console.log("");
    console.log("Top decreases:");
    const biggest = downWeeks
      .slice()
      .sort((a, b) => a.deltaLq - b.deltaLq)
      .slice(0, 5);
    for (const r of biggest) {
      console.log(
        `- W${r.week}: Δlq ${fmtSigned(r.deltaLq, " lq")} (USDG ${fmtSigned(
          r.deltaUsdg,
          ""
        )}, GLW ${fmtSigned(r.deltaGlw, "")}, price Δ${Number.isFinite(r.deltaPrice) ? r.deltaPrice.toFixed(4) : "—"})`
      );
    }
  }

  console.log("");
  console.log(
    [
      "Interpretation hints:",
      "- If lq goes down while both USDG and GLW reserves go down, liquidity was likely removed or moved.",
      "- If one reserve goes up while the other goes down, the pool was likely traded/rebalanced (price moves).",
      "- `pol_lq` is derived from reserves, so it can move with both net deposits/withdrawals and trading dynamics.",
    ].join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

