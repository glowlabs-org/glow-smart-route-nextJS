"use client";

import { ConnectButton } from "@/components/connect-button";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { GlowLockup } from "@/components/glow-lockup";

export const Navbar = () => {
  return (
    <nav className="absolute top-0 px-6 md:px-12 xl:px-16 w-full z-50 bg-transparent">
      <div className="max-w-screen-xl mx-auto h-20 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2 group -ml-1">
          <GlowLockup
            className={cn("w-36 h-12 relative z-10 text-glow-black")}
          />
        </Link>
        <ConnectButton size="small" className="block" variant="default" />
      </div>
    </nav>
  );
};
