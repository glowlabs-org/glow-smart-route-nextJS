// "use client";

// import { useState } from "react";
// import { useQueryState } from "nuqs";
// import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";
// import { WalletSwapStats } from "./wallet-swap-stats";
// import { WalletV2Claims } from "./wallet-v2-claims";
// import { WalletActivityKpis } from "./wallet-activity-kpis";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// function isValidAddress(address: string): boolean {
//   return /^0x[a-fA-F0-9]{40}$/.test(address);
// }

// export default function TestPage() {
//   const [walletAddress, setWalletAddress] = useQueryState("wallet", {
//     defaultValue: "0x5026d1d2418c9f9e1ada4732fffeb6892220f0af",
//     parse: (value) => value || "",
//     serialize: (value) => value || "",
//   });

//   const [inputValue, setInputValue] = useState(walletAddress);

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (isValidAddress(inputValue)) {
//       setWalletAddress(inputValue);
//     }
//   };

//   const currentAddress =
//     walletAddress && isValidAddress(walletAddress) ? walletAddress : undefined;

//   return (
//     <div className="container mx-auto py-8 space-y-6">
//       <Card>
//         <CardHeader>
//           <CardTitle>Wallet Lookup</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <form onSubmit={handleSubmit} className="flex gap-2">
//             <Input
//               type="text"
//               placeholder="Enter wallet address (0x...)"
//               value={inputValue}
//               onChange={(e) => setInputValue(e.target.value)}
//               className="flex-1"
//             />
//             <Button type="submit">Lookup</Button>
//           </form>
//           {inputValue && !isValidAddress(inputValue) && (
//             <p className="text-sm text-destructive mt-2">
//               Please enter a valid Ethereum address
//             </p>
//           )}
//         </CardContent>
//       </Card>

//       {currentAddress && (
//         <>
//           <WalletActivityKpis walletAddress={currentAddress} />
//           <WalletSwapStats walletAddress={currentAddress} />
//           <WalletV2Claims walletAddress={currentAddress} />
//           <RewardsBreakdownPanel walletAddress={currentAddress} />
//         </>
//       )}
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { RewardsBreakdownPanel } from "../wallet/rewards-breakdown-panel";
import { WalletSwapStats } from "./wallet-swap-stats";
import { WalletV2Claims } from "./wallet-v2-claims";
import { WalletActivityKpis } from "./wallet-activity-kpis";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlowSoftDashboard from "./bento";

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default function TestPage() {
  const [walletAddress, setWalletAddress] = useQueryState("wallet", {
    defaultValue: "0x5026d1d2418c9f9e1ada4732fffeb6892220f0af",
    parse: (value) => value || "",
    serialize: (value) => value || "",
  });

  const [inputValue, setInputValue] = useState(walletAddress);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidAddress(inputValue)) {
      setWalletAddress(inputValue);
    }
  };

  const currentAddress =
    walletAddress && isValidAddress(walletAddress) ? walletAddress : undefined;

  return <GlowSoftDashboard />;
}
