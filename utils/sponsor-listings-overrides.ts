import type { AuctionApplication } from "@/hooks/hub-listings";
import {
  LOCAL_MINER_OVERRIDE_APPLICATION_ID,
  getLocalMinerLaunchOverrideVisibleAtIso,
} from "@/utils/nextTuesdayET";
import { isMarketplaceVisibleAt } from "@/utils/launchpad-now";

export function applyLocalSponsorListingOverrides(
  applications: AuctionApplication[],
): AuctionApplication[] {
  const localMinerVisibleAtIso = getLocalMinerLaunchOverrideVisibleAtIso();
  if (!localMinerVisibleAtIso) return applications;

  let didOverrideApplication = false;
  const nextApplications = applications.map((application) => {
    if (
      application.id !== LOCAL_MINER_OVERRIDE_APPLICATION_ID ||
      !application.activeFraction ||
      application.activeFraction.type !== "mining-center"
    ) {
      return application;
    }

    didOverrideApplication = true;
    const totalSteps = application.activeFraction.totalSteps ?? 0;
    return {
      ...application,
      publishedOnAuctionTimestamp: localMinerVisibleAtIso,
      activeFraction: {
        ...application.activeFraction,
        status: "active",
        marketplaceVisibleAt: localMinerVisibleAtIso,
        isFilled: false,
        filledAt: null,
        remainingSteps:
          application.activeFraction.remainingSteps &&
          application.activeFraction.remainingSteps > 0
            ? application.activeFraction.remainingSteps
            : totalSteps,
        splitsSold: 0,
        progressPercent: 0,
      },
    };
  });

  return didOverrideApplication ? nextApplications : applications;
}

export function isLocalMinerLaunchpadDuplicate(
  application: Pick<AuctionApplication, "id" | "activeFraction">,
): boolean {
  return (
    getLocalMinerLaunchOverrideVisibleAtIso() !== null &&
    application.id === LOCAL_MINER_OVERRIDE_APPLICATION_ID &&
    application.activeFraction?.type === "launchpad"
  );
}

export function isSponsorListingVisibleAndOpen(
  application: Pick<AuctionApplication, "activeFraction">,
): boolean {
  const fraction = application.activeFraction;
  if (!fraction) return false;

  const totalSteps = fraction.totalSteps ?? 0;
  const remainingSteps = fraction.remainingSteps ?? 0;

  return (
    !fraction.isFilled &&
    remainingSteps > 0 &&
    totalSteps > 0 &&
    isMarketplaceVisibleAt(fraction.marketplaceVisibleAt)
  );
}
