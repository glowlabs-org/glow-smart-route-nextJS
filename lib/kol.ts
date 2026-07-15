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
  "0xa9d3bf3dc18be924e5bfa1625e72f4fbe8ad8cb4", // Bl0ckJames
  "0xe7356f4f6ce2c21fda650148fbd624e7061e4cc2", // Depin Connection
  "0x56eb8023691b4a86eaa96287151654474611b076", // Nhuelz
] as const;

const KOL_SET = new Set(KOL_WALLETS);

/** Check if a wallet address is an approved KoL. */
export function isKolWallet(address: string | undefined): boolean {
  if (!address) return false;
  return KOL_SET.has(address.toLowerCase());
}
