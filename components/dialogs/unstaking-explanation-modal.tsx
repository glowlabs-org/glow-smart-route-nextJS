"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { useLang } from "@/lib/i18n";

interface UnstakingExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnstakingExplanationModal({
  open,
  onOpenChange,
}: UnstakingExplanationModalProps) {
  const { t } = useLang();
  const s = t.dialogs.unstakingExplanation;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="px-6 pt-8 pb-6 border-b border-border/40">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
            {s.title}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {s.intro}
              <span className="font-medium text-foreground">
                {s.onePercentBold}
              </span>
              .
            </p>

            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-2">
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                {s.exampleHeader}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] mt-0.5">•</span>
                  <span>
                    {s.exampleItem1Prefix}
                    <strong className="text-foreground">
                      {s.exampleItem1Amount}
                    </strong>
                    {s.exampleItem1Body}
                    <strong className="text-foreground">
                      {s.exampleItem1Weeks}
                    </strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] mt-0.5">•</span>
                  <span>
                    {s.exampleItem2Prefix}
                    <strong className="text-foreground">
                      {s.exampleItem2Amount}
                    </strong>
                    {s.exampleItem2Body}
                    <strong className="text-foreground">
                      {s.exampleItem2Rate}
                    </strong>
                    {s.exampleItem2Tail}
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                {s.whyHeader}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">
                      {s.whyStableBold}
                    </strong>
                    {s.whyStableBody}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">
                      {s.whyLongTermBold}
                    </strong>
                    {s.whyLongTermBody}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22D3EE] mt-0.5">•</span>
                  <span>
                    <strong className="text-foreground">
                      {s.whyPredictableBold}
                    </strong>
                    {s.whyPredictableBody}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
            <Link
              href="https://glow.org/blog/beginner-guide-to-gctl"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 group"
            >
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-[#22D3EE] transition-colors">
                  {s.readGuide}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.readGuideSub}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-[#22D3EE] transition-colors" />
            </Link>
          </div>
        </div>

        <div className="border-t border-border/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {s.gotIt}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
