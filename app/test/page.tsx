import ClaimsTestView from "./claims-test-view";
import TestView from "./view";
import { notFound } from "next/navigation";
import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0x3d06bFfcbB4a62791756B6008c2F0001aa61963d";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
