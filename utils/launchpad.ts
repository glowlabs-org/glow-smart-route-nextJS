import {
  isFractionOpenForMarketplace,
  isFractionPubliclyVisible,
} from "@/hooks/hub-listings";

export interface LaunchpadListingLike {
  activeFraction: {
    isFilled: boolean;
    remainingSteps: number | null;
    totalSteps?: number | null;
    marketplaceVisibleAt?: string | null;
  } | null;
}

export function isPublicActiveListing(
  application: LaunchpadListingLike,
  nowMs: number = Date.now()
) {
  return (
    isFractionOpenForMarketplace(application.activeFraction) &&
    isFractionPubliclyVisible(application.activeFraction, nowMs)
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

