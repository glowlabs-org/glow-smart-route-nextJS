"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SendTab } from "@/app/buy/send-tab";
import { tokens, type Token } from "@/app/buy/constants";

interface SendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendDialog({ open, onOpenChange }: SendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Tokens</DialogTitle>
        </DialogHeader>
        <SendTab
          tokens={{
            GLOW: tokens.GLOW,
            USDG: tokens.USDG,
            USDC: tokens.USDC,
            ETH: tokens.ETH,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
