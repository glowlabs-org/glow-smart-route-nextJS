import { Navbar } from "../components/navbar";
import BuyGctlView from "./view";
import { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: "Buy GCTL - Off-chain Purchase",
  description:
    "Buy GCTL tokens off-chain using USDC at a fixed price of $0.75 per GCTL.",
};

export default function BuyGctlPage() {
  return (
    <>
      <Navbar />
      <NuqsAdapter>
        <BuyGctlView />
      </NuqsAdapter>
    </>
  );
}
