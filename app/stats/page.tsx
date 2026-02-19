import type { Metadata } from "next";

import { Header } from "@/components/header";
import { buildPageMetadata } from "@/lib/seo";
import { PolDashboardView } from "@/app/internal/pol/view";

export const metadata: Metadata = buildPageMetadata({
  title: "Glow Economic Dashboard",
  description:
    "Live protocol metrics for Glow: embedded liquidity, token emissions, FDV, GCTL staking, farm revenue, and solar impact. Track the economics of decentralized solar energy in real time.",
  path: "/stats",
});

export const revalidate = 30;

export default function StatsPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <PolDashboardView />
    </>
  );
}
