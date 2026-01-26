import { ImpactBuybackView } from "./view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Impact Buyback",
  description: "Impact buyback details and activity on Glow.",
  path: "/impact-buyback",
  noIndex: true,
});

export default function ImpactBuybackPage() {
  return notFound();
  return <ImpactBuybackView />;
}
