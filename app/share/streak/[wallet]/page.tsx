import { Metadata } from "next";
import { GlowCommit } from "@/components/glow-commit/glow-commit";
import { buildPageMetadata, SEO } from "@/lib/seo";

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
      <p className="mt-6 text-sm text-muted-foreground">
        Track your own mining streak at{" "}
        <a
          href="https://app.glow.org"
          className="underline hover:text-foreground"
        >
          app.glow.org
        </a>
      </p>
    </div>
  );
}
