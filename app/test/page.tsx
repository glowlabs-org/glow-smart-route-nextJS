import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";

export default function TestPage() {
  // return notFound();
  const testWalletAddress = "0x5abcfde6bc010138f65e8dc088927473c49867e4";

  return (
    <div className="container mx-auto py-8">
      <RewardsBreakdownPanel walletAddress={testWalletAddress} />
    </div>
  );
}
