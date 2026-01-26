import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard Preview",
  description:
    "Preview the Glow dashboard experience and wallet-specific views.",
  path: "/test",
  noIndex: true,
});

export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
