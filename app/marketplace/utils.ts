export function formatNumber(value: number, decimals: number = 2): string {
  try {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  } catch {
    return String(value);
  }
}
