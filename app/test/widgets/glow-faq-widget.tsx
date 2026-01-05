"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  id: string;
  q: string;
  a: React.ReactNode;
}

const faqItems: FaqItem[] = [
  {
    id: "item-1",
    q: "What is Glow?",
    a: (
      <div className="space-y-4">
        <p>
          Glow is a solar mining crypto protocol that helps fund the
          construction of real-world solar farms.
        </p>
        <p>
          Solar farms compete to displace the most carbon per dollar of
          electricity revenue.
        </p>
        <p>
          Unlike traditional carbon credits, Glow specifically identifies solar
          opportunities that deliver the greatest impact (CO2 offset) per dollar
          of funding.
        </p>
      </div>
    ),
  },
  {
    id: "item-2",
    q: "What is GLW and why does it matter?",
    a: (
      <div className="space-y-4">
        <p>
          GLW is the utility token of the ecosystem. It serves two main
          purposes:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">Incentive:</strong> Solar farms
            earn GLW as they produce clean energy.
          </li>
          <li>
            <strong className="text-foreground">Governance:</strong> It is used
            to vote on which farms receive funding.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "item-3",
    q: 'What does "delegating GLW" mean?',
    a: (
      <div className="space-y-4">
        <p>
          Delegating is a vetting mechanism. Solar farms need to prove
          efficiency to get funding.
        </p>
        <div className="p-4 rounded-lg bg-background/50 border text-sm">
          GLW holders "vouch" for specific farms by delegating tokens. If the
          farm is efficient, you earn yield. If it is inefficient, you may
          forfeit tokens.
        </div>
      </div>
    ),
  },
  {
    id: "item-4",
    q: 'What is a "Glow miner"?',
    a: (
      <div className="space-y-4">
        <p>
          A Glow miner is a digital representation of a real-world solar
          installation.
        </p>
        <p>
          Purchasable with USDC, it produces GLW tokens for{" "}
          <span className="text-primary font-mono">99 weeks</span> based on the
          electricity the physical farm generates. It bridges DeFi liquidity
          with physical infrastructure.
        </p>
      </div>
    ),
  },
  {
    id: "item-5",
    q: "What is the Impact Leaderboard?",
    a: (
      <div className="space-y-4">
        <p>
          The Impact Leaderboard ranks wallets by{" "}
          <span className="text-primary font-medium">Glow Impact Score</span>—a
          points system designed to reward the actions that most directly grow
          onchain climate impact (especially{" "}
          <span className="text-primary font-medium">
            steering via staked GCTL
          </span>
          ).
        </p>
      </div>
    ),
  },
];

export default function GlowFaqWidget({ className }: { className?: string }) {
  const [activeId, setActiveId] = useState<string>(faqItems[0].id);

  const activeItem = faqItems.find((item) => item.id === activeId);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden bg-card dark:bg-muted/30 border-foreground/10 dark:border-border h-full min-h-[350px]",
        className
      )}
    >
      <CardHeader className="pb-4 shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="tracking-tight text-lg">Glow FAQ</CardTitle>
          </div>
          <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
            Documentation
          </span>
        </div>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left Side: Questions List */}
        <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-r border-border/50 bg-background/20">
          <ScrollArea className="h-full">
            <div className="flex flex-col p-2 gap-1">
              {faqItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "relative text-left px-4 py-3 rounded-md text-sm transition-all duration-200 group flex items-center justify-between",
                    activeId === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="line-clamp-2 pr-2">{item.q}</span>
                  {activeId === item.id && (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Answer Display */}
        <div className="flex-1 bg-card/50 relative">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8">
              {activeItem ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-xl font-semibold mb-6 text-foreground tracking-tight">
                    {activeItem.q}
                  </h3>
                  <div className="text-sm leading-relaxed text-muted-foreground/90">
                    {activeItem.a}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a question
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Decorative background element for the bento feel */}
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none select-none">
            <Sparkles className="w-32 h-32" />
          </div>
        </div>
      </div>
    </Card>
  );
}
