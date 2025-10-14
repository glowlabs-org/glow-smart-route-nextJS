export const GENESIS_TIMESTAMP = 1700352000; //- (86400 * 21); // 21 days before genesis

export function getCurrentEpoch(unixSeconds = Date.now() / 1000): number {
  if (unixSeconds < GENESIS_TIMESTAMP) {
    throw new Error("Timestamp cannot be before genesis");
  }
  // Glow epochs are 1-week intervals since genesis.
  const week = 86400 * 7;
  const timeElapsed = Math.floor(unixSeconds - GENESIS_TIMESTAMP);
  if (timeElapsed < 0) {
    throw new Error("Time elapsed cannot be negative");
  }
  const epoch = Math.floor(timeElapsed / week);
  return epoch;
}

export function dateToEpoch(date: Date): number {
  return getCurrentEpoch(date.getTime() / 1000);
}
