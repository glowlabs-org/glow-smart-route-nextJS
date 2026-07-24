/**
 * KoL (Key Opinion Leader) program constants and helpers.
 */

/**
 * Approved KoL wallet addresses (lowercased). Keep this in exact parity with the
 * backend roster `KOL_PAYBACK_WALLETS` in
 * gca-crm-backend/src/routers/fractions-router/helpers/kol-roster.ts — this list
 * only gates ambassador-dashboard access, so a wallet missing here sees
 * "Access Denied" even while payback accrues on the backend.
 */
export const KOL_WALLETS: readonly string[] = [
  "0xd7f58cfaa74dd2de35b44833ee20be7dab8ecec9", // Eungo
  "0x8f2c0f09f5135312772145a49e633eac05cfbb93", // Joshiker
  "0x4fcc122cdea3c5d6c56f900800adec75cb15b81a", // HB
  "0x913dd1468d8b7ed4c52d4eb41d94b5ff61d0dae6", // Jazz
  "0xe7356f4f6ce2c21fda650148fbd624e7061e4cc2", // Depin
  "0x00eeea79e475df263b499413b150b351e5f2a4da", // Krypto Insider
  "0xa9d3bf3dc18be924e5bfa1625e72f4fbe8ad8cb4", // Bl0ckJames
  "0x66a84c1a14e9f5829c56def9c0563bd64e030d96", // JayPlay
  "0x23fd278a78397d0fd8735834e8340c9f49fdd010", // Inflection
  "0xc3af61653fdf78f6309542f943093b9f75fb9514", // Andy (yourfriendandy)
  "0x56eb8023691b4a86eaa96287151654474611b076", // Nhuelz
  "0x87fc83f37b6762a6ce87e1d5c3333b1d7b6cc832", // TheCrypticWolf (@lironieeth)
] as const;

const KOL_SET = new Set(KOL_WALLETS);

/** Check if a wallet address is an approved KoL. */
export function isKolWallet(address: string | undefined): boolean {
  if (!address) return false;
  return KOL_SET.has(address.toLowerCase());
}
