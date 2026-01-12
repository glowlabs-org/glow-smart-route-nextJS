import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";

import GlowSoftDashboard from "../bento";

interface TestWalletPageProps {
  params: Promise<{
    wallet: string;
  }>;
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

  return <GlowSoftDashboard walletAddressOverride={walletAddress} />;
}
