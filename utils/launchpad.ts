import { isFractionPubliclyVisible } from "@/hooks/hub-listings";

export interface LaunchpadListingLike {
  activeFraction: {
    isFilled: boolean;
    remainingSteps: number | null;
    totalSteps: number | null;
    marketplaceVisibleAt?: string | null;
  } | null;
}

export function isPublicActiveListing(
  application: LaunchpadListingLike,
  nowMs: number = Date.now()
) {
  const fraction = application.activeFraction;
  if (!fraction) return false;

  const totalSteps = fraction?.totalSteps ?? 0;
  const remainingSteps = fraction?.remainingSteps ?? 0;

  return (
    !fraction.isFilled &&
    remainingSteps > 0 &&
    totalSteps > 0 &&
    isFractionPubliclyVisible(fraction, nowMs)
  );
}

export function countActiveListings(
  applications: LaunchpadListingLike[],
  nowMs: number = Date.now()
) {
  return applications.reduce((count, app) => {
    return isPublicActiveListing(app, nowMs) ? count + 1 : count;
  }, 0);
}
