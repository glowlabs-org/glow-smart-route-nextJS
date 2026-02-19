import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Steer Solar Development with GCTL",
  description:
    "Mint and stake Glow Control (GCTL) to direct where solar infrastructure gets built.Boost your Impact Score.",
  path: "/gctl",
});

export default function GctlLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
