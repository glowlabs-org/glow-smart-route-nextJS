"use client";

import { ConnectButton } from "@/components/connect-button";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { GlowLockup } from "@/components/glow-lockup";
import { useState } from "react";
import { useAccount } from "wagmi";
import { WalletSidebar } from "@/components/wallet-sidebar";
import { Button } from "@/components/ui/button";

export const Navbar = ({
  glowPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
}: {
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isConnected, address } = useAccount();
  return (
    <nav className="absolute top-0 px-6 md:px-12 xl:px-16 w-full z-50 bg-transparent">
      <div className="max-w-screen-xl mx-auto h-20 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2 group -ml-1">
          <GlowLockup
            className={cn("w-36 h-12 relative z-10 text-glow-black")}
          />
        </Link>
        <div className="flex items-center space-x-8">
          <Link
            href="/mining-marketplace"
            className="hover:scale-105 transition-all"
          >
            Mining Marketplace
          </Link>

          {isConnected ? (
            <Button onClick={() => setIsOpen(!isOpen)}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
            </Button>
          ) : (
            <ConnectButton className="block" variant="default" size="medium" />
          )}
        </div>
      </div>
      <WalletSidebar
        open={isOpen}
        onOpenChange={setIsOpen}
        glowPrice={glowPrice}
        marketCap={marketCap}
        ethPriceInUSD={ethPriceInUSD}
        usdcRewardPool={usdcRewardPool}
      />
    </nav>
  );
};
