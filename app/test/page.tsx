import TestView from "./view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test - USDG/Glow Swap on Sepolia",
  description: "Test page for swapping USDG and Glow tokens on Sepolia testnet",
};

export default function TestPage() {
  return <TestView />;
}