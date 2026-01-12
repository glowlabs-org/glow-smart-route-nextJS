import { Metadata } from "next";
import { GlowCommit } from "@/components/glow-commit/glow-commit";

interface PageProps {
  params: Promise<{ wallet: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  const shortAddress = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return {
    title: `Glow Mining Streak - ${shortAddress}`,
    description: `Check out this wallet's Glow mining streak on Glow.org`,
    openGraph: {
      title: `Glow Mining Streak`,
      description: `${shortAddress}'s mining streak on Glow`,
      type: "website",
      url: `https://app.glow.org/share/streak/${wallet}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `Glow Mining Streak`,
      description: `${shortAddress}'s mining streak on Glow`,
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
