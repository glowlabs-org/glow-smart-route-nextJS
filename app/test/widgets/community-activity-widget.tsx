"use client";

import React, { useState } from "react";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommunityActivityWidgetProps {
  className?: string;
  variant?: "default" | "minimal";
}

export default function CommunityActivityWidget({
  className,
  variant = "default",
}: CommunityActivityWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMinimal = variant === "minimal";

  return (
    <>
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden",
          isMinimal
            ? "bg-transparent border-transparent"
            : "bg-card dark:bg-muted/20 border-foreground/10 dark:border-border",
          className
        )}
      >
        <CardHeader className={cn("pb-3", isMinimal && "px-0 pt-0")}>
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight text-lg">
              Latest Launchpad Activity
            </CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
              Recent
            </span>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "min-h-0 flex-1 flex flex-col gap-4 pt-0",
            isMinimal && "px-0"
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <SponsoredFarmsActivity
              variant="widget"
              maxRows={5}
              showViewAll={false}
              className="h-full flex flex-col !p-0"
              constrainHeight={false}
            />
          </div>

          <div className="shrink-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(true)}
              className="w-full h-12 font-mono font-bold text-base"
            >
              See All Activity
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Recent Activity</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <SponsoredFarmsActivity variant="full" constrainHeight={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
