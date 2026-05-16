import type { Metadata } from "next";

import { Header } from "@/components/header";
import { buildPageMetadata } from "@/lib/seo";
import { ShopView } from "@/app/shop/view";

export const metadata: Metadata = buildPageMetadata({
  title: "Points Shop - Glow",
  description:
    "Spend your Glow points in the weekly points shop: miner, watts, mega, and early-access prizes. Restocks every Tuesday.",
  path: "/shop",
});

export default function ShopPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <ShopView />
    </>
  );
}
