// Tuesday, Jan 27 2026 at 10:02 AM EST (15:02 UTC).
const DEFAULT_REFERRAL_LAUNCH_AT = "2026-01-27T15:02:46Z";
export const REFERRAL_LAUNCH_LABEL = "Tuesday 27 at 10:02am EST";

function parseLaunchDate(value: string | undefined): Date {
  const candidate = value?.trim() || DEFAULT_REFERRAL_LAUNCH_AT;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(DEFAULT_REFERRAL_LAUNCH_AT);
  }
  return parsed;
}

export function getReferralLaunchDate(): Date {
  return parseLaunchDate(process.env.NEXT_PUBLIC_REFERRAL_LAUNCH_AT);
}

export function getReferralLaunchTimestamp(): number {
  return getReferralLaunchDate().getTime();
}
