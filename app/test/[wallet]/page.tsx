import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";

import GlowSoftDashboard from "../bento";

interface TestWalletPageProps {
  params: {
    wallet: string;
  };
}

export default function TestWalletPage({ params }: TestWalletPageProps) {
  const rawWallet = decodeURIComponent(params.wallet ?? "");
  if (!isAddress(rawWallet)) notFound();

  const walletAddress = getAddress(rawWallet);

  return <GlowSoftDashboard walletAddressOverride={walletAddress} />;
}


