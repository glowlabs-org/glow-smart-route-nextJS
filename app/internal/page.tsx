import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import InternalView from "./view";

export const metadata: Metadata = buildPageMetadata({
  title: "Internal",
  description: "Internal Glow tooling.",
  path: "/internal",
  noIndex: true,
});

export default function InternalPage() {
  return (
    <>
      <Header withIsScrolled={true} />

      <InternalView />
    </>
  );
}
