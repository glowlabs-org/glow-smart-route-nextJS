"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  MessageCircle,
  Users,
  Zap,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Custom Discord Icon
function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
    </svg>
  );
}

interface DiscordWidgetProps {
  className?: string;
}

export default function DiscordWidget({ className }: DiscordWidgetProps) {
  return (
    <Card
      className={cn(
        "relative group flex h-full flex-col overflow-hidden bg-[#5865F2] border-0 text-white shadow-xl transition-all hover:bg-[#4752C4]",
        className
      )}
    >
      {/* Background Decor: Giant Logo positioned to fill negative space without blocking text */}
      <div className="absolute -right-8 -bottom-12 opacity-[0.12] pointer-events-none group-hover:opacity-20 transition-all duration-500 ease-out group-hover:scale-105 group-hover:-rotate-12">
        <DiscordLogo className="h-56 w-56" />
      </div>

      <CardContent className="relative z-10 flex h-full flex-col justify-between p-6 md:p-8">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 opacity-80">
              <DiscordLogo className="h-5 w-5" />
              <span className="text-xs font-mono font-medium tracking-wider uppercase">
                Community
              </span>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 backdrop-blur-md border border-white/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wide text-white/90">
                ONLINE
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              Join us on Discord
            </h3>

            {/* Stats / Features Grid to fill empty space */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white/90 font-semibold">
                  <Users className="h-4 w-4" />
                  <span>7k+ Members</span>
                </div>
                <p className="text-xs text-white/60">Global community</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white/90 font-semibold">
                  <Zap className="h-4 w-4" />
                  <span>24/7 Community</span>
                </div>
                <p className="text-xs text-white/60">
                  Ask questions and get help
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-8">
          <Button variant="default">
            <Link
              href="https://discord.gg/glowfnd"
              target="_blank"
              rel="noreferrer"
            >
              <span className="flex items-center gap-2">Join Server</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
