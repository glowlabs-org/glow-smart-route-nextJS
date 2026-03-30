import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";
import { InternalPasswordGate } from "./internal-password-gate";
import InternalView from "./view";

export const metadata: Metadata = buildPageMetadata({
  title: "Internal",
  description: "Internal Glow tooling.",
  path: "/internal",
  noIndex: true,
});

export default async function InternalPage() {
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();

  return (
    <>
      <Header withIsScrolled={true} />
      {isAuthorized ? (
        <InternalView />
      ) : (
        <InternalPasswordGate configured={isConfigured} />
      )}
    </>
  );
}
