export const MIN_INITIAL_POSITION_USD = 200;
export const INITIAL_POSITION_USD_GRACE = 10;

export interface InitialPositionValueGuardInput {
  purchaseValueUsd: number;
  hasExistingPositions: boolean;
  minimumUsd?: number;
  graceUsd?: number;
}

export interface InitialPositionValueGuardResult {
  isBlocked: boolean;
  minimumUsd: number;
  purchaseValueUsd: number;
  shortfallUsd: number;
  message: string | null;
}

export function getInitialPositionValueGuard(
  params: InitialPositionValueGuardInput,
): InitialPositionValueGuardResult {
  const minimumUsd = params.minimumUsd ?? MIN_INITIAL_POSITION_USD;
  const graceUsd = params.graceUsd ?? INITIAL_POSITION_USD_GRACE;
  const purchaseValueUsd = Number.isFinite(params.purchaseValueUsd)
    ? Math.max(0, params.purchaseValueUsd)
    : 0;
  const isBlocked =
    !params.hasExistingPositions && purchaseValueUsd + graceUsd < minimumUsd;
  const shortfallUsd = isBlocked
    ? Math.max(0, minimumUsd - purchaseValueUsd)
    : 0;

  return {
    isBlocked,
    minimumUsd,
    purchaseValueUsd,
    shortfallUsd,
    message: isBlocked
      ? `Your first miner or delegation should total at least $${minimumUsd.toLocaleString()} so weekly reward claims stay worth the gas. Add about $${shortfallUsd.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} more to this first position.`
      : null,
  };
}
