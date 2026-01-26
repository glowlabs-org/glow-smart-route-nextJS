import { Header } from "@/components/header";
import BuyGctlView from "./view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Internal",
  description: "Internal Glow tooling.",
  path: "/internal",
  noIndex: true,
});

export default function BuyGctlPage() {
  // return notFound();

  return (
    <>
      <Header withIsScrolled={true} />

      <BuyGctlView />
    </>
  );
}
