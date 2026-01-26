"use client";

import * as React from "react";
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

interface NewsletterWidgetProps {
  className?: string;
  variant?: "default" | "minimal";
}

export default function NewsletterWidget({
  className,
  variant = "default",
}: NewsletterWidgetProps) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success">(
    "idle"
  );
  const source = "newsletter_widget";
  const isMinimal = variant === "minimal";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    trackEvent("dashboard_newsletter_subscribe_submit", {
      source,
      wallet_connected: false,
      wallet_address: null,
    });

    let stage: "api" | "exception" = "exception";
    let httpStatus: number | null = null;

    try {
      stage = "api";
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      httpStatus = res.status;

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      setStatus("success");
      toast.success("Welcome to the inner circle!");
      setEmail("");
      trackEvent("dashboard_newsletter_subscribe_success", {
        source,
        wallet_connected: false,
        wallet_address: null,
        http_status: res.status,
      });

      // Reset status after a delay to allow adding another email if needed
      setTimeout(() => setStatus("idle"), 5000);
    } catch (error) {
      console.error(error);
      trackEvent("dashboard_newsletter_subscribe_error", {
        source,
        wallet_connected: false,
        wallet_address: null,
        stage,
        http_status: httpStatus,
        error_name: error instanceof Error ? error.name : "unknown",
      });
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
      setStatus("idle");
    }
  };

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
          : "bg-card dark:bg-card border-border/20 dark:border-border/40",
        className
      )}
    >
      {/* Background Decor: Warm Ambient Glow */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[color:var(--color-glow-orange)]/5 blur-[80px] pointer-events-none transition-colors duration-700 group-hover:bg-[color:var(--color-glow-orange)]/10 dark:bg-[color:var(--color-glow-orange)]/8 dark:group-hover:bg-[color:var(--color-glow-orange)]/12" />

      {/* Background Decor: Giant Icon Watermark */}
      <div className="absolute -right-6 -bottom-8 opacity-[0.04] dark:opacity-[0.06] pointer-events-none select-none transition-all duration-700 group-hover:opacity-[0.07] dark:group-hover:opacity-[0.09] group-hover:-translate-y-2">
        <Mail className="h-48 w-48 text-foreground rotate-[-15deg]" />
      </div>

      <CardContent
        className={cn(
          "relative z-10 flex flex-col justify-between h-full p-6 md:p-8",
          isMinimal && "p-6 md:p-6"
        )}
      >
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-glow-orange)]/10 border border-[color:var(--color-glow-orange)]/20">
              <Sparkles className="h-4 w-4 text-[color:var(--color-glow-orange)]" />
            </div>
            <span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 uppercase">
              Newsletter
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground tracking-tight">
              Stay in the loop.
            </h3>
            <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground leading-relaxed max-w-[90%]">
              Join our monthly newsletter for Glow&apos;s latest updates on
              solar innovation, protocol developments, and impact stories.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="pt-6 mt-auto">
          {status === "success" ? (
            <div className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20 dark:border-emerald-500/30 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-mono font-semibold text-sm uppercase tracking-wide">You're on the list!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative">
              <div className="group/input relative flex items-center">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  className="h-14 rounded-xl pl-5 pr-14 bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 text-foreground placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground/80 transition-all hover:bg-muted/40 dark:hover:bg-muted/60 hover:border-[color:var(--color-glow-orange)]/30 focus-visible:ring-1 focus-visible:ring-[color:var(--color-glow-orange)]/40 focus-visible:border-[color:var(--color-glow-orange)]/60"
                  required
                />
                <div className="absolute right-1.5">
                  <Button
                    type="submit"
                    size="icon"
                    disabled={status === "loading" || !email}
                    className={cn(
                      "h-11 w-11 rounded-xl transition-all duration-300",
                      email
                        ? "bg-foreground text-background hover:bg-foreground/90 hover:scale-105"
                        : "bg-muted/50 dark:bg-muted/70 text-muted-foreground hover:bg-muted/60 dark:hover:bg-muted/80"
                    )}
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowRight
                        className={cn("h-5 w-5", email && "animate-pulse-slow")}
                      />
                    )}
                    <span className="sr-only">Subscribe</span>
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
