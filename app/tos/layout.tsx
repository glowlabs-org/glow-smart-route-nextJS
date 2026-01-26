import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Review Glow's terms of service for using the Glow Mining platform.",
  path: "/tos",
});

export default function TosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
