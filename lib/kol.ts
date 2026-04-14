/**
 * KoL (Key Opinion Leader) program constants and helpers.
 */

/** Approved KoL wallet addresses (lowercased). */
export const KOL_WALLETS: readonly string[] = [
  "0xd7f58cfaa74dd2de35b44833ee20be7dab8ecec9", // Eungo
  "0x8f2c0f09f5135312772145a49e633eac05cfbb93", // Joshiker
  "0x4fcc122cdea3c5d6c56f900800adec75cb15b81a",
  "0x913dd1468d8b7ed4c52d4eb41d94b5ff61d0dae6", // Jazz
  "0xd5199714f0bf37e5b163e287ffc83e896890ff4a", // Irene
] as const;

const KOL_SET = new Set(KOL_WALLETS);

/** Check if a wallet address is an approved KoL. */
export function isKolWallet(address: string | undefined): boolean {
  if (!address) return false;
  return KOL_SET.has(address.toLowerCase());
}
