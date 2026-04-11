function formatUsdWhole(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTokenAmount(
  value: number,
  params?: { maximumFractionDigits?: number },
) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: params?.maximumFractionDigits ?? 0,
  }).format(value);
}

export function getClaimableBreakdown(params: {
  claimableTotalsByCurrency: Record<string, number> | undefined;
}) {
  const { claimableTotalsByCurrency } = params;
  const totals = claimableTotalsByCurrency ?? {};

  const entries = [
    {
      currency: "GLW",
      value: totals.GLW ?? 0,
      label: `${formatTokenAmount(totals.GLW ?? 0, { maximumFractionDigits: 0 })} GLW`,
      isPrimary: false,
    },
    {
      currency: "USDG",
      value: totals.USDG ?? 0,
      label: formatUsdWhole(totals.USDG ?? 0),
      subLabel: "USDG",
      isPrimary: false,
    },
    {
      currency: "SGCTL",
      value: totals.SGCTL ?? 0,
      label: `${formatTokenAmount(totals.SGCTL ?? 0, { maximumFractionDigits: 0 })} sGCTL`,
      isPrimary: false,
    },
  ].filter((entry) => Number.isFinite(entry.value) && entry.value > 0);

  if (entries.length > 0) {
    return entries.map((entry, index) => ({
      ...entry,
      isPrimary: index === 0,
    }));
  }

  return [
    {
      currency: "GLW",
      value: 0,
      label: "0 GLW",
      isPrimary: true,
    },
  ];
}

export function formatNextClaimLabel(
  nonFinalizedTotals: Record<string, number> | undefined,
) {
  const totals = nonFinalizedTotals ?? {};
  const entries: string[] = [];

  if ((totals.GLW ?? 0) > 0) {
    entries.push(`${formatTokenAmount(totals.GLW ?? 0)} GLW`);
  }
  if ((totals.USDG ?? 0) > 0) {
    entries.push(`${formatUsdWhole(totals.USDG ?? 0)} USDG`);
  }
  if ((totals.SGCTL ?? 0) > 0) {
    entries.push(`${formatTokenAmount(totals.SGCTL ?? 0)} sGCTL`);
  }

  return entries.length > 0 ? entries.join(" + ") : null;
}

export function formatProtocolDepositAsset(asset: string | null | undefined) {
  if (!asset) return "GLW";
  const normalized = asset.toUpperCase();
  if (normalized === "GCTL") return "SGCTL";
  return normalized;
}

export function normalizeDashboardAsset(asset: string | null | undefined) {
  return formatProtocolDepositAsset(asset);
}

export function parseProtocolDepositTokenAmount(
  value: string,
  asset: string | null | undefined,
) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;

  const normalized = formatProtocolDepositAsset(asset);
  const decimals =
    normalized === "SGCTL" || normalized === "USDG" || normalized === "USDC"
      ? 1e6
      : 1e18;

  return num / decimals;
}
