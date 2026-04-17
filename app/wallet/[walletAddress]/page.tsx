import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import type { Metadata } from "next";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { buildPageMetadata } from "@/lib/seo";
import { Header } from "@/components/header";
import { HydrationWrapper } from "@/app/components/hydration-wrapper";
import { prefetchDashboardLaunchpadData } from "@/lib/server/dashboard-launchpad-prefetch";
import GlowSoftDashboard from "@/app/test/bento";

interface WalletProfilePageProps {
  params: Promise<{
    walletAddress: string;
  }>;
}

export async function generateMetadata({
  params,
}: WalletProfilePageProps): Promise<Metadata> {
  const { walletAddress } = await params;
  let rawWallet = walletAddress;
  try {
    rawWallet = decodeURIComponent(walletAddress ?? "");
  } catch {
    rawWallet = walletAddress ?? "";
  }

  const shortAddress =
    rawWallet.length > 10
      ? `${rawWallet.slice(0, 6)}...${rawWallet.slice(-4)}`
      : rawWallet;

  return buildPageMetadata({
    title: `${shortAddress} - Glow Dashboard`,
    description: `View the Glow impact score and dashboard for ${shortAddress}.`,
    path: `/wallet/${encodeURIComponent(walletAddress)}`,
  });
}

export default async function WalletProfilePage({
  params,
}: WalletProfilePageProps) {
  const { walletAddress } = await params;

  let rawWallet = "";
  try {
    rawWallet = decodeURIComponent(walletAddress ?? "");
  } catch {
    notFound();
  }

  if (!isAddress(rawWallet)) notFound();

  const checksumAddress = getAddress(rawWallet);
  const queryClient = new QueryClient();

  await prefetchDashboardLaunchpadData(queryClient, {
    prefetchRewardScores: false,
    prefetchMiningScores: false,
    prefetchLiveSoon: false,
  });
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationWrapper state={dehydratedState}>
      <>
        <Header />
        <GlowSoftDashboard walletAddressOverride={checksumAddress} />
      </>
    </HydrationWrapper>
  );
}
