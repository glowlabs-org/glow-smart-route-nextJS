"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/telemetry";
import { addGlwToWallet } from "@/lib/wallet-watch-asset";
import { cn } from "@/lib/utils";

type AddGlwToWalletButtonAppearance =
  | "button"
  | "drawer"
  | "menu"
  | "subtle";

export interface AddGlwToWalletButtonProps {
  appearance?: AddGlwToWalletButtonAppearance;
  className?: string;
  source: string;
}

export function AddGlwToWalletButton({
  appearance = "button",
  className,
  source,
}: AddGlwToWalletButtonProps) {
  const [isPending, setIsPending] = React.useState(false);

  const handleClick = React.useCallback(async () => {
    if (isPending) return;

    setIsPending(true);
    trackEvent("add_glw_to_wallet_click", { source });

    try {
      const wasAdded = await addGlwToWallet();

      if (wasAdded) {
        toast.success("GLW added to wallet", {
          description: "GLW should now appear in your wallet asset list.",
        });
        trackEvent("add_glw_to_wallet_result", {
          source,
          status: "success",
        });
      } else {
        toast("GLW was not added", {
          description: "The wallet request was dismissed.",
        });
        trackEvent("add_glw_to_wallet_result", {
          source,
          status: "dismissed",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add GLW to wallet";

      toast.error(message);
      trackEvent("add_glw_to_wallet_result", {
        source,
        status: "error",
        error_message: message,
      });
    } finally {
      setIsPending(false);
    }
  }, [isPending, source]);

  if (appearance === "menu") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "block w-full select-none space-y-1 rounded-xl p-3 text-left leading-none no-underline outline-none transition-all duration-200",
          "hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
          "dark:hover:bg-accent/10 dark:hover:text-zinc-100 dark:focus:bg-accent/10 dark:focus:text-zinc-100",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium leading-none">
          <Wallet className="h-4 w-4 shrink-0" />
          <span>{isPending ? "Adding GLW..." : "Add GLW to wallet"}</span>
        </div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          Import the GLW token into your wallet&apos;s asset list.
        </p>
      </button>
    );
  }

  if (appearance === "drawer") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "block w-full rounded-lg px-4 py-3 text-left transition-colors",
          "hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
      >
        <div className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 shrink-0" />
          <span>{isPending ? "Adding GLW..." : "Add GLW to wallet"}</span>
        </div>
      </button>
    );
  }

  if (appearance === "subtle") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
      >
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        <span>{isPending ? "Adding GLW..." : "Add GLW to wallet"}</span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      className={cn("w-full", className)}
    >
      <Wallet className="mr-2 h-4 w-4" />
      {isPending ? "Adding GLW..." : "Add GLW to wallet"}
    </Button>
  );
}
