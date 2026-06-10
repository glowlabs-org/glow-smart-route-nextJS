"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Zap,
  Trophy,
  Check,
} from "lucide-react";
import { PointsIcon, PointsShopIcon } from "@/components/impact-icons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

const BANNER = "/images/holding-hands.jpg";

interface Feature {
  key: string;
  Icon: React.ComponentType<{ className?: string }>;
  chip: string;
  tagline: string;
  heading: string;
  body: string;
  highlights: string[];
}

const FEATURES: Feature[] = [
  {
    key: "points",
    Icon: PointsIcon,
    chip: "bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]",
    tagline: "Points are now a spendable currency.",
    heading: "Reworked Points System",
    body: "Points are no longer just a score, they’re a currency you spend in the new shop. You earn them the moment you participate, and your existing balance carried over.",
    highlights: [
      "Earn points from delegation",
      "Earn points from delegated sGCTL",
      "Earn points from miner activity",
      "Keep a weekly streak by staying active",
    ],
  },
  {
    key: "watts",
    Icon: Zap,
    chip: "bg-[#16a34a]/10 text-[#16a34a] dark:bg-[#4ade80]/10 dark:text-[#4ade80]",
    tagline: "Impact is now measured in watts.",
    heading: "Watts & the New Leaderboard",
    body: "Every funded solar farm shares its watts with the people who made it happen: delegators, stakers and their referrers. That’s your real, on-the-ground impact.",
    highlights: [
      "Earn watts from funded farms",
      "Carbon credits, calculated per farm",
      "Leaderboard now ranks by impact",
    ],
  },
  {
    key: "shop",
    Icon: PointsShopIcon,
    chip: "bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]",
    tagline: "Spend your points in the shop.",
    heading: "The Points Shop",
    body: "Put your points to work. Redeem them for miners, watts, early access and a weekly mega prize. Fresh inventory drops every week, first come, first served.",
    highlights: [
      "Miners, watts & mega prizes",
      "Restocks every week",
      "Early-access perks for miners",
    ],
  },
];

const CTAS: {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { label: "Earn points", href: "/?earn=1", Icon: PointsIcon },
  { label: "View the leaderboard", href: "/leaderboard", Icon: Trophy },
  { label: "Open the Points Shop", href: "/shop", Icon: PointsShopIcon },
];

// step 0 = overview, 1..3 = features, last = get started
const TOTAL_STEPS = FEATURES.length + 2;
const LAST = TOTAL_STEPS - 1;

export interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once per open when the user reaches the final slide. */
  onComplete?: () => void;
}

export function WhatsNewModal({
  open,
  onOpenChange,
  onComplete,
}: WhatsNewModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = React.useState(0);
  const completedRef = React.useRef(false);

  // Reset to the first slide each time the modal opens.
  React.useEffect(() => {
    if (open) {
      setStep(0);
      completedRef.current = false;
      trackEvent("whats_new_modal_view");
    }
  }, [open]);

  // Mark "seen" once the user has gone through every slide.
  React.useEffect(() => {
    if (open && step === LAST && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
      trackEvent("whats_new_modal_complete");
    }
  }, [open, step, onComplete]);

  const goNext = () => setStep((s) => Math.min(s + 1, LAST));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const close = () => onOpenChange(false);

  const fade = (dir: number) =>
    shouldReduceMotion
      ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, x: dir * 24 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: dir * -24 },
        };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden border border-border/60 shadow-2xl sm:max-w-[480px] rounded-3xl bg-white dark:bg-card"
      >
        <DialogTitle className="sr-only">What&apos;s new in Glow</DialogTitle>
        <DialogDescription className="sr-only">
          An overview of the reworked points system, the new watts impact system
          and leaderboard, and the points shop.
        </DialogDescription>

        {/* Banner */}
        <div className="relative h-44 w-full shrink-0">
          <Image
            src={BANNER}
            alt=""
            fill
            priority
            sizes="480px"
            className="object-cover"
          />
          <span className="absolute left-4 top-4 rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-widest text-foreground backdrop-blur-sm">
            What&apos;s new
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-[268px] px-7 pt-7 pb-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              {...fade(1)}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            >
              {step === 0 ? (
                <OverviewStep />
              ) : step === LAST ? (
                <GetStartedStep onNavigate={close} />
              ) : (
                <FeatureStep feature={FEATURES[step - 1]} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: back · dots · next/done */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-7 pb-7 pt-3">
          <div className="justify-self-start">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step
                    ? "w-5 bg-foreground"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>

          <div className="justify-self-end">
            {step < LAST ? (
              <Button size="sm" onClick={goNext} className="gap-1.5">
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={close}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverviewStep() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">
          What&apos;s new in Glow
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ve reworked how rewards and impact work. Here&apos;s
          everything that&apos;s new.
        </p>
      </div>
      <ul className="space-y-3.5">
        {FEATURES.map((f) => (
          <li key={f.key} className="flex items-center gap-3.5">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                f.chip,
              )}
            >
              <f.Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {f.heading}
              </div>
              <div className="text-xs text-muted-foreground">{f.tagline}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureStep({ feature }: { feature: Feature }) {
  return (
    <div className="space-y-5">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          feature.chip,
        )}
      >
        <feature.Icon className="h-6 w-6" />
      </span>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{feature.heading}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.body}
        </p>
      </div>
      <ul className="space-y-2.5">
        {feature.highlights.map((h) => (
          <li key={h} className="flex items-center gap-2.5 text-sm">
            <Check className="h-4 w-4 shrink-0 text-[#16a34a] dark:text-[#4ade80]" />
            <span className="text-foreground/90">{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GetStartedStep({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">
          You&apos;re all set
        </h2>
        <p className="text-sm text-muted-foreground">
          Jump straight into the new experience.
        </p>
      </div>
      <div className="space-y-3">
        {CTAS.map((cta) => (
          <Link
            key={cta.href}
            href={cta.href}
            onClick={() => {
              trackEvent("whats_new_modal_cta", { href: cta.href });
              onNavigate();
            }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/30 px-4 py-3.5 transition-colors hover:border-border/70 hover:bg-muted/50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 text-foreground">
                <cta.Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {cta.label}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
