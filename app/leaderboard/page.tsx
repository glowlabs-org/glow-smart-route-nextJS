import { Header } from "@/components/header";
import RewardsView from "./view";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

const baseMetadata = buildPageMetadata({
  title: "Impact Leaderboard",
  description:
    "Explore Glow's impact leaderboard and see top wallets by measured solar impact.",
  path: "/leaderboard",
});

// Use relative URLs so Next.js resolves them via `metadataBase` (set in the
// root layout). Manually building absolute URLs skips that pipeline and can
// cause X/Twitter to fall back to the small "summary" card.
export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: {
    ...baseMetadata.openGraph,
    images: [
      {
        url: "/leaderboard/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Glow Impact Leaderboard",
      },
    ],
  },
  twitter: {
    ...baseMetadata.twitter,
    images: ["/leaderboard/twitter-image"],
  },
};

export default function RewardsPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <RewardsView />
    </>
  );
}
