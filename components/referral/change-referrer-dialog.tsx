"use client";

import * as React from "react";
import { useReferral } from "@/hooks/use-referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { trackEvent } from "@/lib/telemetry";

interface ChangeReferrerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentReferrerEns?: string;
  currentReferrerWallet?: string;
  mock?: {
    changeReferrer?: (code: string) => Promise<void>;
    isChanging?: boolean;
  };
}

export function ChangeReferrerDialog({
  open,
  onOpenChange,
  currentReferrerEns,
  currentReferrerWallet,
  mock,
}: ChangeReferrerDialogProps) {
  const referral = useReferral();
  const changeReferrer = mock?.changeReferrer ?? referral.changeReferrer;
  const isChanging = mock?.isChanging ?? referral.isChanging;
  const [newCode, setNewCode] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    try {
      trackEvent("referral_change_submit", { newCode });
      await changeReferrer(newCode);
      trackEvent("referral_change_success", { newCode });
      onOpenChange(false);
    } catch (e) {
      // toast handled in hook
    }
  };

  const displayName = currentReferrerEns || (currentReferrerWallet ? `${currentReferrerWallet.slice(0, 6)}...${currentReferrerWallet.slice(-4)}` : "Unknown");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Change Referrer
          </DialogTitle>
          <DialogDescription>
            You are currently linked to <span className="font-bold text-foreground">{displayName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              You can only change your referrer during the{" "}
              <span className="text-foreground font-medium">7-day grace period</span>{" "}
              while your referral is pending. After activation, the link is permanent.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-ref-code" className="text-xs font-bold uppercase tracking-widest pl-1">New Referral Code</label>
              <Input
                id="new-ref-code"
                name="newReferralCode"
                placeholder="e.g. bob.eth or b2x4y9…"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="h-12 rounded-xl font-mono"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                disabled={isChanging}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-bold gap-2"
              disabled={isChanging || !newCode.trim()}
            >
              {isChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isChanging ? "Updating…" : "Update Referrer"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
