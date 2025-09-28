"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlowLaunchpadRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the root page with launchpad tab
    router.replace("/?tab=launchpad");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-lg font-medium">
          Redirecting to Glow Launchpad...
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          The launchpad is now available on the home page.
        </p>
      </div>
    </div>
  );
}
