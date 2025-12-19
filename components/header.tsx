"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Menu,
  X,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  useAccount,
} from "wagmi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

import { cn } from "@/lib/utils";

import { GlowLockup } from "./glow-lockup";
import { TosDialog } from "./tos-dialog";
import { ThemeToggle } from "./ui/theme-toggle";
import { useRefundableFractions } from "@/hooks/useFractionSplits";
import { WalletStatus } from "./wallet-status";

// ListItem component for navigation menu content
const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & {
    title: string;
  }
>(({ className, title, children, href, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          href={href || "#"}
          className={cn(
            "block select-none space-y-1 rounded-xl p-3 leading-none no-underline outline-none transition-all duration-200",
            "hover:bg-foreground  dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export interface HeaderHamburgerMenuProps {
  triggerClassName?: string;
}

export function HeaderHamburgerMenu({
  triggerClassName,
}: HeaderHamburgerMenuProps) {
  return (
    <Drawer direction="right" shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <motion.button
          className={cn(
            "p-2 rounded-xl border border-border bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100",
            triggerClassName
          )}
          whileTap={{ scale: 0.95 }}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </motion.button>
      </DrawerTrigger>

      <DrawerContent
        showHandle={false}
        className="fixed right-0 inset-y-0 h-screen w-80 max-w-[85vw] bg-background backdrop-blur-xl border-l border-border shadow-2xl"
      >
        <DrawerHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <GlowLockup className="w-32 h-10" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DrawerClose asChild>
                <motion.button
                  className="p-2 rounded-xl hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </DrawerClose>
            </div>
          </div>
          <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
          <DrawerDescription className="sr-only">
            Main navigation menu with links to different sections of the website.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-2">
            <div className="pt-4 border-t border-border mt-4">
              <div className="space-y-2">
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    App
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="/?tab=launchpad"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Glow Launchpad
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/glow-swap?tab=swap"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Swap
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/glow-swap?tab=liquidity"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Liquidity
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/wallet"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Wallet
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/stats/rewards"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Glow Leaderboard
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/stats"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Protocol Stats
                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Impact
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="https://impact.glow.org"
                        target="_blank"
                        rel="noreferrer"
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Infrastructure projects
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://impact.glow.org/new-campaign"
                        target="_blank"
                        rel="noreferrer"
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Create a Region
                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Resources
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/blog"
                        target="_blank"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Blog
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/press"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Press
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/branding"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Branding
                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Audits
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/audits"
                        target="_blank"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Solar Farms Map
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/audits?view=list"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Solar Farms List
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/gves"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Glow Verification Entities
                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Data
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/archives"
                        target="_blank"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Archives
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/weekly-reports"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Weekly Reports
                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="https://glow.org/rewards"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          setTimeout(() => {
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }, 100);
                        }}
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        Rewards
                      </Link>
                    </DrawerClose>
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function Header({
  withIsScrolled = true,
}: {
  withIsScrolled?: boolean;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const { address, isConnected } = useAccount();
  const router = useRouter();

  // Check for refundable fractions
  const { refundableFractions, summary } = useRefundableFractions({
    walletAddress: address || null,
    enabled: Boolean(address && isConnected),
  });

  // Clean up localStorage for claimed refunds and show toast for new refunds
  React.useEffect(() => {
    // Clean up localStorage - remove dismissed refunds that no longer exist
    const dismissedRefunds = JSON.parse(
      localStorage.getItem("dismissedRefunds") || "[]"
    ) as string[];

    if (dismissedRefunds.length > 0) {
      const currentFractionIds = refundableFractions.map(
        (refund) => refund.fraction.id
      );
      const stillValidDismissed = dismissedRefunds.filter((id) =>
        currentFractionIds.includes(id)
      );

      // Update localStorage if there are dismissed refunds that no longer exist
      if (stillValidDismissed.length !== dismissedRefunds.length) {
        localStorage.setItem(
          "dismissedRefunds",
          JSON.stringify(stillValidDismissed)
        );
      }
    }

    // Show toast for new refunds
    if (
      refundableFractions.length > 0 &&
      summary.totalRefundableFractions > 0
    ) {
      // Filter out refunds that have been dismissed
      const newRefunds = refundableFractions.filter(
        (refund) => !dismissedRefunds.includes(refund.fraction.id)
      );

      // Only show toast if there are new (non-dismissed) refunds
      if (newRefunds.length > 0) {
        const fractionIds = newRefunds.map((refund) => refund.fraction.id);

        const toastId = toast.error(
          `You have ${newRefunds.length} refund${
            newRefunds.length > 1 ? "s" : ""
          } available`,
          {
            description:
              "Click to claim your refunds from expired farm sponsorships",
            duration: Infinity, // Keep toast until dismissed
            position: "top-right",
            action: {
              label: "Claim Refunds",
              onClick: () => {
                // Mark these refunds as dismissed in localStorage
                const currentDismissed = JSON.parse(
                  localStorage.getItem("dismissedRefunds") || "[]"
                ) as string[];
                const updatedDismissed = [...currentDismissed, ...fractionIds];
                localStorage.setItem(
                  "dismissedRefunds",
                  JSON.stringify(updatedDismissed)
                );

                router.push("/wallet");
                toast.dismiss(toastId);
              },
            },
            onDismiss: () => {
              // Mark these refunds as dismissed when user manually dismisses
              const currentDismissed = JSON.parse(
                localStorage.getItem("dismissedRefunds") || "[]"
              ) as string[];
              const updatedDismissed = [...currentDismissed, ...fractionIds];
              localStorage.setItem(
                "dismissedRefunds",
                JSON.stringify(updatedDismissed)
              );
              toast.dismiss(toastId);
            },
          }
        );

        // Return cleanup function to dismiss toast if component unmounts
        return () => {
          toast.dismiss(toastId);
        };
      }
    }
  }, [refundableFractions, summary.totalRefundableFractions]);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [withIsScrolled]);

  return (
    <>
      <motion.header
        className={cn(
          "fixed w-full z-50 transition-all duration-300 px-6 md:px-12 xl:px-16",
          withIsScrolled && scrolled
            ? "bg-background shadow-sm"
            : "bg-transparent"
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 group">
            <GlowLockup className="w-24 md:w-36 h-12 relative z-10 text-zinc-900 dark:text-zinc-100" />
          </Link>

          <nav className="hidden lg:flex items-center gap-2">
            <Link
              href="/glow-swap?tab=swap"
              className="text-zinc-900 dark:text-zinc-100 transition-colors text-base px-4 py-2 rounded-xl hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 font-medium"
            >
              Swap
            </Link>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    App
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[300px]">
                      <ListItem href="/?tab=launchpad" title="Glow Launchpad">
                        Delegate GLW to solar farms or buy miners with USDC
                      </ListItem>
                      <ListItem href="/glow-swap?tab=swap" title="Swap">
                        Swap GLW, USDG, and more
                      </ListItem>
                      <ListItem
                        href="/glow-swap?tab=liquidity"
                        title="Liquidity"
                      >
                        Add liquidity to the GLW/USDG pool and earn rewards
                      </ListItem>
                      <ListItem href="/wallet" title="Wallet">
                        View your balances, delegations, and claim rewards
                      </ListItem>
                      <ListItem href="/stats/rewards" title="Glow Leaderboard">
                        View top wallets and rewards leaderboard
                      </ListItem>
                      <ListItem href="/stats" title="Protocol Stats">
                        Real-time protocol metrics and market data
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    Impact
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://impact.glow.org"
                        title="Infrastructure projects"
                      >
                        See the list of infrastructure projects
                      </ListItem>
                      <ListItem
                        href="https://impact.glow.org/new-campaign"
                        title="Create a Region"
                      >
                        Create a new infrastructure project
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    Resources
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://glow.org/blog"
                        title="Blog"
                        target="_blank"
                      >
                        Latest news and insights
                      </ListItem>
                      <ListItem
                        href="https://glow.org/press"
                        title="Press"
                        target="_blank"
                      >
                        Press releases and media coverage
                      </ListItem>
                      <ListItem
                        href="https://glow.org/branding"
                        title="Branding"
                        target="_blank"
                      >
                        Brand assets and guidelines
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    Audits
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://glow.org/audits"
                        title="Audits"
                        target="_blank"
                      >
                        Solar Farms Map
                      </ListItem>
                      <ListItem
                        href="https://glow.org/audits?view=list"
                        title="Audits"
                        target="_blank"
                      >
                        Solar Farms List
                      </ListItem>
                      <ListItem
                        href="https://glow.org/gves"
                        title="GVEs"
                        target="_blank"
                      >
                        Glow Verification Entities
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100 mr-6">
                    Data
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[300px]">
                      <ListItem
                        href="https://glow.org/archives"
                        title="Archives"
                        target="_blank"
                      >
                        Access historical data and records
                      </ListItem>
                      <ListItem
                        href="https://glow.org/weekly-reports"
                        title="Weekly Reports"
                        target="_blank"
                      >
                        View detailed weekly performance reports
                      </ListItem>
                      <ListItem
                        href="https://glow.org/rewards"
                        title="Rewards"
                        target="_blank"
                      >
                        View Farm Rewards
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <WalletStatus />
            </div>
          </nav>

          {/* Mobile controls */}
          <div className="flex items-center gap-3 lg:hidden">
            {/* Always-visible connect button to the left of the hamburger */}
            <WalletStatus />
            <Drawer direction="right" shouldScaleBackground={false}>
              <DrawerTrigger asChild>
                <motion.button
                  className="p-2 rounded-xl border border-border bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100"
                  whileTap={{ scale: 0.95 }}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </motion.button>
              </DrawerTrigger>

              <DrawerContent
                showHandle={false}
                className="fixed right-0 inset-y-0 h-screen w-80 max-w-[85vw] bg-background backdrop-blur-xl border-l border-border shadow-2xl"
              >
                <DrawerHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <GlowLockup className="w-32 h-10" />
                    <div className="flex items-center gap-2">
                      {/* Theme toggle moved inside the drawer on mobile */}
                      <ThemeToggle />
                      <DrawerClose asChild>
                        <motion.button
                          className="p-2 rounded-xl hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                          whileTap={{ scale: 0.95 }}
                          aria-label="Close menu"
                        >
                          <X className="h-5 w-5" />
                        </motion.button>
                      </DrawerClose>
                    </div>
                  </div>
                  <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    Main navigation menu with links to different sections of the
                    website.
                  </DrawerDescription>
                </DrawerHeader>

                {/* Navigation Items */}
                <div className="p-6 flex-1 overflow-y-auto">
                  <nav className="space-y-2">
                    {/* Dropdown Menus */}
                    <div className="pt-4 border-t border-border mt-4">
                      <div className="space-y-2">
                        {/* App Menu */}
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            App
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="/?tab=launchpad"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Glow Launchpad
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="/glow-swap?tab=swap"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Swap
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="/glow-swap?tab=liquidity"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Liquidity
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="/wallet"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Wallet
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="/stats/rewards"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Glow Leaderboard
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="/stats"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Protocol Stats
                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        {/* Impact Menu */}
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Impact
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="https://impact.glow.org"
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Infrastructure projects
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://impact.glow.org/new-campaign"
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Create a Region
                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        {/* Resources Menu */}
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Resources
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/blog"
                                target="_blank"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Blog
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/press"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Press
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/branding"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Branding
                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        {/* Audits Menu */}
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Audits
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/audits"
                                target="_blank"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Solar Farms Map
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/audits?view=list"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Solar Farms List
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/gves"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Glow Verification Entities
                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        {/* Data Menu */}
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Data
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/archives"
                                target="_blank"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Archives
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/weekly-reports"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Weekly Reports
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Link
                                href="https://glow.org/rewards"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  setTimeout(() => {
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Rewards
                              </Link>
                            </DrawerClose>
                          </div>
                        </div>
                      </div>
                    </div>
                  </nav>
                </div>

                {/* Footer CTA */}
                <div className="border-t border-border bg-muted p-4">
                  <WalletStatus className="w-full justify-between h-12" />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </motion.header>
      <TosDialog />
    </>
  );
}
