import { Header } from "@/components/header";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  isReferralDashboardAuthorized,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";
import { InternalPasswordGate } from "../internal-password-gate";
import { ToolboxClient } from "./toolbox-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Internal Toolbox",
  description: "Internal Glow marketing and ops toolbox.",
  path: "/internal/toolbox",
  noIndex: true,
});

export default async function ToolboxPage() {
  const isAuthorized = await isReferralDashboardAuthorized();
  const isConfigured = isReferralDashboardPasswordConfigured();

  return (
    <>
      <Header withIsScrolled={true} />
      {isAuthorized ? (
        <ToolboxClient />
      ) : (
        <InternalPasswordGate configured={isConfigured} />
      )}
    </>
  );
}
