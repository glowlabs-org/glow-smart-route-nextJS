import { Header } from "@/components/header";
import RewardsView from "./view";
import type { Metadata } from "next";
import { buildPageMetadata, SEO } from "@/lib/seo";

const baseMetadata = buildPageMetadata({
  title: "Impact Leaderboard",
  description:
    "Explore Glow's impact leaderboard and see top wallets by impact score.",
  path: "/stats/rewards",
});

export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: {
    ...baseMetadata.openGraph,
    images: [
      {
        url: `${SEO.siteUrl}/stats/rewards/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Glow Impact Leaderboard",
      },
    ],
  },
  twitter: {
    ...baseMetadata.twitter,
    images: [`${SEO.siteUrl}/stats/rewards/twitter-image`],
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
