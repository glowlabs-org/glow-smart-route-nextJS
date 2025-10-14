export interface NumberFormatOptions {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  signDisplay?: "auto" | "never" | "always" | "exceptZero";
}

export function formatUsd(
  value: number | null | undefined,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const {
    maximumFractionDigits = 0,
    minimumFractionDigits = 0,
    signDisplay = "auto",
  } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits,
    signDisplay,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const {
    maximumFractionDigits = 0,
    minimumFractionDigits = 0,
    signDisplay,
  } = options;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits,
    signDisplay,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const {
    maximumFractionDigits = 1,
    minimumFractionDigits = 0,
    signDisplay = "auto",
  } = options;
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay,
  }).format(value / 100);
}

export function formatToken(
  value: number | null | undefined,
  token: string,
  options: NumberFormatOptions = {}
): string {
  const formatted = formatNumber(value, options);
  if (formatted === "—") return formatted;
  return `${formatted} ${token}`;
}
