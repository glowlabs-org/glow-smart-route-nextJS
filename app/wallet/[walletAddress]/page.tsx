import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { Header } from "@/components/header";
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

  return (
    <>
      <Header />
      <GlowSoftDashboard walletAddressOverride={checksumAddress} />
    </>
  );
}
