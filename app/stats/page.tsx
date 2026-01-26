import { Header } from "@/components/header";
import StatsView from "./view";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Protocol Stats",
  description:
    "Track Glow protocol metrics, supply, and network performance in real time.",
  path: "/stats",
});

export default function StatsPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <StatsView />
    </>
  );
}
