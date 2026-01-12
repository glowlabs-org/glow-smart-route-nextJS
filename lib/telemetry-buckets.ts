function isValidAmount(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export function bucketUsd(amount: number) {
  if (!isValidAmount(amount)) return "unknown";
  if (amount < 25) return "0-25";
  if (amount < 100) return "25-100";
  if (amount < 250) return "100-250";
  if (amount < 1000) return "250-1000";
  return "1000+";
}

export function bucketEth(amount: number) {
  if (!isValidAmount(amount)) return "unknown";
  if (amount < 0.01) return "0-0.01";
  if (amount < 0.1) return "0.01-0.1";
  if (amount < 1) return "0.1-1";
  return "1+";
}

export function bucketToken(amount: number) {
  if (!isValidAmount(amount)) return "unknown";
  if (amount < 10) return "0-10";
  if (amount < 100) return "10-100";
  if (amount < 1000) return "100-1000";
  return "1000+";
}


