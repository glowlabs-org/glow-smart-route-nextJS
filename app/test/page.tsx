import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0x39be20d7577f5584b545540dd18312f3c2890d2a";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
