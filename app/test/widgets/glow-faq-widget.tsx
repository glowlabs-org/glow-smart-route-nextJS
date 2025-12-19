"use client";

import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus } from "lucide-react";

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

const faqItems: FaqItem[] = [
  {
    q: "What is Glow?",
    a: (
      <div>
        Glow is a crypto-powered protocol that helps fund the construction of
        real world solar farms. Glow specifically identifies solar opportunities
        that create the greatest impact per dollar of funding.
      </div>
    ),
  },
  {
    q: "What is GLW and why does it matter?",
    a: (
      <div>
        GLW is the core token of the Glow ecosystem. It's the token that solar
        farms earn as they produce clean energy, and it's also the token that
        gets used to select which farms get supported by the Glow protocol.
      </div>
    ),
  },
  {
    q: 'What does "delegating GLW to solar farms" mean?',
    a: (
      <div>
        To participate in the Glow protocol, a solar farm needs to demonstrate
        that it can make efficient use of the funding provided by Glow. GLW
        holders can vouch for the efficiency of a solar farm by delegating their
        tokens to it. The delegators earn extra GLW tokens for picking efficient
        farms, but may forfeit tokens if they pick inefficient solar farms.
      </div>
    ),
  },
  {
    q: 'What is a "Glow miner"?',
    a: (
      <div>
        A Glow miner works much like a Bitcoin miner. It is part of a Glow solar
        farm that earns tokens every week as the solar farm produces
        electricity. A Glow miner can be purchased for USDC, and will produce
        GLW tokens every week for 99 weeks.
      </div>
    ),
  },
];

export default function GlowFaqWidget() {
  return (
    <Card className="col-span-12 lg:col-span-9 h-full max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="tracking-tight">Glow FAQ</CardTitle>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Getting started
          </span>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {faqItems.map((item, idx) => (
            <Collapsible
              key={idx}
              className="rounded-2xl border bg-card overflow-hidden"
            >
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                <span className="text-sm font-medium">{item.q}</span>
                <span className="ml-4 inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted shrink-0">
                  <Plus className="h-4 w-4 text-primary" />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 text-sm text-muted-foreground">
                {item.a}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
