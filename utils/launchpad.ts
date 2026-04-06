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

export function filterPublicLaunchpadApplications<
  T extends {
    activeFraction: { marketplaceVisibleAt?: string | null } | null;
  },
>(applications: T[], nowMs: number = Date.now()) {
  return applications.filter((application) =>
    isFractionPubliclyVisible(application.activeFraction, nowMs)
  );
}

export function getListingVisibleStartAtMs<
  T extends {
    publishedOnAuctionTimestamp?: string | null;
    activeFraction?: { marketplaceVisibleAt?: string | null } | null;
  },
>(application: T): number | null {
  const visibleAtMs = Date.parse(
    application.activeFraction?.marketplaceVisibleAt ?? "",
  );
  if (Number.isFinite(visibleAtMs)) return visibleAtMs;

  const publishedAtMs = Date.parse(application.publishedOnAuctionTimestamp ?? "");
  if (Number.isFinite(publishedAtMs)) return publishedAtMs;

  return null;
}
