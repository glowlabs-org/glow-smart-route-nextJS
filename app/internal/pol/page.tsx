import type { Metadata } from "next";

import { Header } from "@/components/header";
import { buildPageMetadata } from "@/lib/seo";
import { PolDashboardView } from "./view";

export const metadata: Metadata = buildPageMetadata({
  title: "Protocol Health (Internal)",
  description: "Internal protocol health dashboard prototype for PoL metrics.",
  path: "/internal/pol",
  noIndex: true,
});

export default function PolDashboardPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <PolDashboardView />
    </>
  );
}
