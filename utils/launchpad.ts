export interface LaunchpadListingLike {
  activeFraction: {
    isFilled: boolean;
    remainingSteps: number | null;
  } | null;
}

export function countActiveListings(applications: LaunchpadListingLike[]) {
  return applications.reduce((count, app) => {
    const fraction = app.activeFraction;
    if (!fraction) return count;
    const remainingSteps = fraction.remainingSteps ?? 0;
    const hasAvailability = !fraction.isFilled && remainingSteps > 0;
    return hasAvailability ? count + 1 : count;
  }, 0);
}


