import ClaimsTestView from "./claims-test-view";
import TestView from "./view";
import { notFound } from "next/navigation";
import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0xD50c6DB59245a424376c4062705D1eBA0131fA0A";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
