import ClaimsTestView from "./claims-test-view";
import TestView from "./view";
import { notFound } from "next/navigation";
import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0x6884efd53b2650679996D3Ea206D116356dA08a9";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
