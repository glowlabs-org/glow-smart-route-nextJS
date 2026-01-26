import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Referral",
  description:
    "Join Glow via a referral code and start earning rewards in the Glow ecosystem.",
  path: "/r",
  noIndex: true,
});

export default function ReferralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
