import ClaimsTestView from "./claims-test-view";
import TestView from "./view";
import { notFound } from "next/navigation";
import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0x77f41144e787cb8cd29a37413a71f53f92ee050c";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
