import type { Metadata } from "next";

import { Header } from "@/components/header";
import { buildPageMetadata } from "@/lib/seo";
import { PolDashboardView } from "@/app/internal/pol/view";

export const metadata: Metadata = buildPageMetadata({
  title: "Glow Economic Overview",
  description:
    "Track Glow economic activity, embedded liquidity, and protocol growth in real time.",
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
