const Decimal = require("decimal.js");

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || process.env.HUB_URL;
const CONTROL_URL =
  process.env.NEXT_PUBLIC_CONTROL_API_URL || process.env.CONTROL_API_URL;
if (!HUB_URL) {
  console.error("Missing NEXT_PUBLIC_HUB_URL or HUB_URL env var.");
  process.exit(1);
}

const FARM_FILTER = (process.argv[2] || "Dyno Aerie").toLowerCase();

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function toGlw(amountWei) {
  return new Decimal(amountWei || "0").div(1e18);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const farmsUrl = `${HUB_URL}/fractions/farms-per-piece-stats`;
  const completedUrl = `${HUB_URL}/applications/completed`;

  const [stats, completed] = await Promise.all([
    fetchJson(farmsUrl),
    fetchJson(completedUrl),
  ]);

  const regionByAppId = new Map();
  for (const app of completed || []) {
    if (!app?.id) continue;
    const regionId = app.zone?.id ?? null;
    const regionName =
      app.zone?.name ||
      app.farm?.regionFullName ||
      app.farm?.region ||
      (regionId ? `Region ${regionId}` : "Unassigned");
    regionByAppId.set(app.id, { regionId, regionName });
  }

  const farms = Array.isArray(stats?.farms) ? stats.farms : [];
  const matches = farms.filter((farm) => {
    const name = (farm.farmName || "").toLowerCase();
    const appId = (farm.appId || "").toLowerCase();
    return name.includes(FARM_FILTER) || appId.includes(FARM_FILTER);
  });

  if (matches.length === 0) {
    const fallback = (completed || []).filter((app) => {
      const name = (app.farm?.name || "").toLowerCase();
      const appId = (app.id || "").toLowerCase();
      return name.includes(FARM_FILTER) || appId.includes(FARM_FILTER);
    });

    if (fallback.length === 0) {
      console.log(`No farms matched "${FARM_FILTER}". Showing sample names:`);
      farms.slice(0, 10).forEach((farm) => {
        console.log(`- ${farm.farmName || "Unknown"} (${farm.appId})`);
      });
      return;
    }

    for (const app of fallback) {
      const launchpad = app.fractions?.find((f) => f.type === "launchpad");
      if (!launchpad) {
        console.log(`No launchpad fraction for ${app.id}`);
        continue;
      }

      const totalAmountWei = (launchpad.splits || []).reduce((sum, split) => {
        const amount = new Decimal(split.amount || "0");
        return sum.plus(amount);
      }, new Decimal(0));
      const totalDelegated = totalAmountWei.div(1e18).toNumber();
      const sponsorSplitPercent = launchpad.sponsorSplitPercent;
      const expectedWeeklyCarbonCredits = Number(
        app.netCarbonCreditEarningWeekly || 0
      );
      const regionId = app.zone?.id;

      let estimated = null;
      if (CONTROL_URL && sponsorSplitPercent !== undefined && regionId) {
        const response = await fetch(
          `${CONTROL_URL}/farms/estimate-reward-scores-batch`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              farms: [
                {
                  userId: "0x000000000000000000000000000000000000dEaD",
                  sponsorSplitPercent,
                  protocolDepositAmount: totalAmountWei.toFixed(0),
                  paymentCurrency: "GLW",
                  expectedWeeklyCarbonCredits,
                  regionId,
                },
              ],
            }),
          }
        ).then((r) => r.json());

        if (response?.results?.[0]?.success) {
          const data = response.results[0].data;
          const glw = Number(data.userWeeklyGlwRewards || "0") / 1e18;
          const pd = Number(data.userWeeklyPdRewards || "0") / 1e18;
          estimated = { glw, pd, total: glw + pd };
        }
      }

      const projectedDepositRoi = estimated
        ? (estimated.pd / totalDelegated) * 100 * 100
        : 0;
      const projectedSafe = projectedDepositRoi;

      console.log("\n==============================");
      console.log(`${app.farm?.name || "Unknown"} (${app.id})`);
      console.log(
        `Region: ${app.zone?.name || "Unassigned"} (${app.zone?.id || "n/a"})`
      );
      console.log(
        `Total delegated (from splits): ${formatNumber(totalDelegated, 0)} GLW`
      );
      console.log(
        `Sponsor split % (delegators): ${sponsorSplitPercent ?? "n/a"}`
      );
      console.log(
        `Expected weekly carbon credits: ${expectedWeeklyCarbonCredits}`
      );
      if (estimated) {
        console.log(
          `Estimated weekly rewards: ${formatNumber(
            estimated.total,
            4
          )} GLW (inflation ${formatNumber(
            estimated.glw,
            4
          )}, PD ${formatNumber(estimated.pd, 4)})`
        );
        console.log(
          `Projected safe ROI (100 weeks, PD only): ${projectedSafe.toFixed(1)}%`
        );
      } else {
        console.log("No estimate available (missing control URL or params).");
      }
    }
    return;
  }

  for (const farm of matches) {
    const stepsSold = Number(farm.delegator?.stepsSold || 0);
    const totalDelegated = toGlw(farm.delegator?.weightedPieceSizeGlw)
      .mul(stepsSold)
      .toNumber();

    const inflationEarned = toGlw(
      farm.delegator?.rewardsPerPiece?.inflation?.allWeeks
    )
      .mul(stepsSold)
      .toNumber();
    const protocolDepositEarned = toGlw(
      farm.delegator?.rewardsPerPiece?.protocolDeposit?.allWeeks
    )
      .mul(stepsSold)
      .toNumber();
    const totalEarned = inflationEarned + protocolDepositEarned;

    const inflationLastWeekFromPieces = toGlw(
      farm.delegator?.rewardsPerPiece?.inflation?.lastWeek
    )
      .mul(stepsSold)
      .toNumber();
    const totalLastWeekFromPieces = toGlw(
      farm.delegator?.rewardsPerPiece?.total?.lastWeek
    )
      .mul(stepsSold)
      .toNumber();
    const breakdown = farm.delegator?.weeklyBreakdown || [];
    const latestWeek = breakdown.reduce(
      (acc, row) => (row.weekNumber > acc.weekNumber ? row : acc),
      { weekNumber: -1, inflationRewards: "0", protocolDepositRewards: "0", totalRewards: "0" }
    );
    const inflationLastWeekFromBreakdown = toGlw(
      latestWeek.inflationRewards
    ).toNumber();
    const protocolDepositLastWeekFromBreakdown = toGlw(
      latestWeek.protocolDepositRewards
    ).toNumber();
    const totalLastWeekFromBreakdown = toGlw(
      latestWeek.totalRewards
    ).toNumber();
    const inflationLastWeek =
      inflationLastWeekFromBreakdown > 0
        ? inflationLastWeekFromBreakdown
        : inflationLastWeekFromPieces;
    const totalLastWeek =
      totalLastWeekFromBreakdown > 0
        ? totalLastWeekFromBreakdown
        : totalLastWeekFromPieces;

    const safeRoi = totalDelegated > 0 ? (totalEarned / totalDelegated) * 100 : 0;
    const depositOnlyRoi =
      totalDelegated > 0 ? (protocolDepositEarned / totalDelegated) * 100 : 0;

    const weeksEarned = Number(farm.delegator?.weeksEarned || 0);
    const weeksLeft = Number(farm.delegator?.weeksLeft || 0);
    const totalWeeks = weeksEarned + weeksLeft;
    const projectedDepositRoi =
      weeksEarned > 0
        ? (depositOnlyRoi / weeksEarned) * totalWeeks
        : 0;
    const projectedSafeRoi = projectedDepositRoi + safeRoi - depositOnlyRoi;

    const weeklyRewardsPercent =
      totalDelegated > 0 ? (totalLastWeek / totalDelegated) * 100 : 0;
    const remainingPercent = Math.max(0, 100 - projectedSafeRoi);
    const weeksToSafe =
      remainingPercent <= 0
        ? 0
        : weeklyRewardsPercent > 0
        ? remainingPercent / weeklyRewardsPercent
        : null;

    const regionMeta = regionByAppId.get(farm.appId) || {};

    console.log("\n==============================");
    console.log(`${farm.farmName || "Unknown"} (${farm.appId})`);
    console.log(
      `Region: ${regionMeta.regionName || "Unassigned"} (${regionMeta.regionId || "n/a"})`
    );
    console.log(`Weeks: earned ${weeksEarned}, left ${weeksLeft}`);
    console.log(`Steps sold: ${stepsSold}`);
    console.log(
      `Total delegated: ${formatNumber(totalDelegated, 0)} GLW`
    );
    console.log(
      `Inflation earned: ${formatNumber(inflationEarned, 0)} GLW`
    );
    console.log(
      `Protocol deposit earned: ${formatNumber(protocolDepositEarned, 0)} GLW`
    );
    console.log(`Inflation last week: ${formatNumber(inflationLastWeek, 4)} GLW`);
    console.log(`Total rewards last week: ${formatNumber(totalLastWeek, 4)} GLW`);
    console.log(`Total earned: ${formatNumber(totalEarned, 0)} GLW`);
    console.log(`Safe ROI (deposit + inflation): ${safeRoi.toFixed(1)}%`);
    console.log(`Deposit-only ROI: ${depositOnlyRoi.toFixed(1)}%`);
    console.log(
      `Projected deposit-only ROI: ${projectedDepositRoi.toFixed(1)}%`
    );
    console.log(
      `Projected safe ROI (deposit projection + earned inflation): ${projectedSafeRoi.toFixed(1)}%`
    );
    console.log(
      `Weekly rewards % of principal: ${weeklyRewardsPercent.toFixed(3)}%`
    );
    console.log(
      `Weeks to safe at current inflation: ${weeksToSafe === null ? "n/a" : weeksToSafe.toFixed(1)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
