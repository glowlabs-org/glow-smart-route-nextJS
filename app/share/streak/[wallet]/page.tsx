import { Metadata } from "next";
import { GlowCommit } from "@/components/glow-commit/glow-commit";
import { buildPageMetadata, SEO } from "@/lib/seo";
import { TrackOwnStreakLink } from "./track-own-streak-link";

interface PageProps {
  params: Promise<{ wallet: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  const shortAddress = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  const metadata = buildPageMetadata({
    title: `Glow Mining Streak - ${shortAddress}`,
    description: `Check out ${shortAddress}'s Glow mining streak on Glow.`,
    path: `/share/streak/${wallet}`,
    noIndex: true,
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      url: `${SEO.siteUrl}/share/streak/${wallet}`,
    },
  };
}

export default async function ShareStreakPage({ params }: PageProps) {
  const { wallet } = await params;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <GlowCommit walletAddress={wallet} />
      <TrackOwnStreakLink />
    </div>
  );
}
