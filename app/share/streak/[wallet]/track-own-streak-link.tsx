"use client";

import { useLang } from "@/lib/i18n";

export function TrackOwnStreakLink() {
  const { t } = useLang();
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      {t.routes.streak.trackOwnStreakAt}{" "}
      <a
        href="https://app.glow.org"
        className="underline hover:text-foreground"
      >
        app.glow.org
      </a>
    </p>
  );
}
