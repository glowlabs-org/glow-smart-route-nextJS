import Image from "next/image";
import { ExternalLink, Zap, Globe } from "lucide-react";
import { GlowLockup } from "@/components/glow-lockup";
import { GctlLandingCta } from "./view";

export default function GctlLandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-background">
        {/* Left Side - Content */}
        <div className="order-2 lg:order-1 lg:flex-1 flex flex-col lg:justify-between p-6 sm:p-8 lg:p-16 lg:min-h-screen">
          <div className="hidden lg:block">
            <GlowLockup className="h-6 sm:h-8 w-auto" />
          </div>

          <div className="lg:flex-1 flex flex-col lg:justify-center max-w-md py-0 lg:py-0">
            <div className="mb-3 sm:mb-4 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Glow Control (GCTL)
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-4 sm:mb-6">
              Decide Where Solar{" "}
              <span className="text-[color:var(--color-glow-orange)]">
                Gets Built
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
              GCTL lets you decide where Glow builds solar farms. Stake GCTL
              and support the regions you care about, and boost your Impact
              Score by 3 points per GLW that you control.
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-6 sm:mb-8">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="h-3.5 w-3.5 text-[#22D3EE]" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    +3 pts per GLW steered
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Boost your weekly Impact Score
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-[color:var(--color-glow-orange)]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="h-3.5 w-3.5 text-[color:var(--color-glow-orange)]" />
                </div>
                <div>
                  <div className="text-sm font-medium">Fund solar globally</div>
                  <div className="text-xs text-muted-foreground">
                    Choose regions: Utah, Colorado, Clean Grid Project, and more
                  </div>
                </div>
              </div>
            </div>

            <a
              href="https://glow.org/blog/beginner-guide-to-gctl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 sm:mb-8"
            >
              Learn how GCTL works
              <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </a>

            {/* Interactive CTA + footer text (client boundary) */}
            <GctlLandingCta />
          </div>

          {/* Spacer for lg layout */}
          <div className="hidden lg:block" />
        </div>

        {/* Right Side - Hero Image (SSR, cached by Next.js) */}
        <div className="order-1 lg:order-2 h-[45vh] lg:h-auto lg:flex-1 p-3 sm:p-4 lg:p-8 lg:min-h-screen">
          <div className="relative h-full w-full rounded-xl sm:rounded-2xl overflow-hidden">
            <Image
              src="/images/referral-hero.jpg"
              alt="Solar panels with worker"
              fill
              className="object-cover object-center"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

            {/* Mobile logo */}
            <div className="absolute top-4 left-4 lg:hidden">
              <GlowLockup className="h-6 w-auto brightness-0 invert" />
            </div>

            {/* Stats badges */}
            <div className="absolute top-12 sm:top-8 lg:top-12 left-0 right-0 px-4 sm:px-8 lg:px-12">
              <div className="flex justify-center gap-6 sm:gap-12 lg:gap-24">
                <div className="text-center text-white">
                  <div className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight">
                    175K
                  </div>
                  <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                    GLW / Week
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                    Steered by GCTL
                    <br />
                    stakers each week
                  </div>
                  <div className="text-[10px] text-white/80 sm:hidden">
                    Steered weekly
                  </div>
                </div>

                <div className="text-center text-white">
                  <div className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight">
                    3x
                  </div>
                  <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                    Impact Points
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                    Per GLW steered
                    <br />
                    to your regions
                  </div>
                  <div className="text-[10px] text-white/80 sm:hidden">
                    Per GLW steered
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
