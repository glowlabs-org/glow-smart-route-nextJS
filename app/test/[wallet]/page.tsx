import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import type { Metadata } from "next";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { buildPageMetadata } from "@/lib/seo";
import { HydrationWrapper } from "@/app/components/hydration-wrapper";
import { prefetchDashboardLaunchpadData } from "@/lib/server/dashboard-launchpad-prefetch";

import GlowSoftDashboard from "../bento";

interface TestWalletPageProps {
  params: Promise<{
    wallet: string;
  }>;
}

export async function generateMetadata({
  params,
}: TestWalletPageProps): Promise<Metadata> {
  const { wallet } = await params;
  let rawWallet = wallet;
  try {
    rawWallet = decodeURIComponent(wallet ?? "");
  } catch {
    rawWallet = wallet ?? "";
  }

  const shortAddress =
    rawWallet.length > 10
      ? `${rawWallet.slice(0, 6)}...${rawWallet.slice(-4)}`
      : rawWallet;

  return buildPageMetadata({
    title: `Dashboard Preview - ${shortAddress}`,
    description: `Preview the Glow dashboard for ${shortAddress}.`,
    path: `/test/${encodeURIComponent(wallet)}`,
    noIndex: true,
  });
}

export default async function TestWalletPage({ params }: TestWalletPageProps) {
  const { wallet } = await params;

  let rawWallet = "";
  try {
    rawWallet = decodeURIComponent(wallet ?? "");
  } catch {
    notFound();
  }

  if (!isAddress(rawWallet)) notFound();

  const walletAddress = getAddress(rawWallet);
  const queryClient = new QueryClient();

  await prefetchDashboardLaunchpadData(queryClient);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationWrapper state={dehydratedState}>
      <GlowSoftDashboard walletAddressOverride={walletAddress} />
    </HydrationWrapper>
  );
}
