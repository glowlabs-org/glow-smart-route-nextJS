"use client";

import * as React from "react";
import { getReferralLaunchTimestamp } from "@/lib/referral-launch";

export function useReferralLaunch() {
  const launchAt = getReferralLaunchTimestamp();
  const [isLive, setIsLive] = React.useState(() => Date.now() >= launchAt);

  React.useEffect(() => {
    if (isLive) return;
    let timer: number | null = null;
    const schedule = () => {
      const remaining = launchAt - Date.now();
      if (remaining <= 0) {
        setIsLive(true);
        return;
      }
      const delay = Math.min(remaining, 2_147_483_647);
      timer = window.setTimeout(() => {
        if (Date.now() >= launchAt) {
          setIsLive(true);
          return;
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [isLive, launchAt]);

  return { isLive, launchAt };
}
