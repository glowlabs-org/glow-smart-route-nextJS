"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  Wallet,
  ChevronDown,
  Copy,
  Loader2,
  LogOut,
  User,
  List,
  Plus,
  DollarSign,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount, useDisconnect } from "wagmi";
import { toast } from "sonner";
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

import { useForwarder } from "@glowlabs-org/utils/browser";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { GlowLockup } from "./glow-lockup";
import { ConnectButton } from "./connect-button";

// ListItem component for navigation menu content
const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & {
    title: string;
    shouldApplyScrolledStyles?: boolean;
  }
>(
  (
    {
      className,
      title,
      children,
      href,
      shouldApplyScrolledStyles = true,
      ...props
    },
    ref
  ) => {
    return (
      <li>
        <NavigationMenuLink asChild>
          <Link
            ref={ref}
            href={href || "#"}
            className={cn(
              "block select-none space-y-1 rounded-xl p-3 leading-none no-underline outline-none transition-all duration-200",
              shouldApplyScrolledStyles
                ? "hover:bg-foreground hover:border-border focus:bg-foreground focus:text-foreground"
                : "hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white",
              className
            )}
            {...props}
          >
            <div
              className={cn(
                "text-sm font-medium leading-none",
                !shouldApplyScrolledStyles && "text-white/90"
              )}
            >
              {title}
            </div>
            <p
              className={cn(
                "line-clamp-2 text-sm leading-snug",
                shouldApplyScrolledStyles
                  ? "text-muted-foreground"
                  : "text-white/70"
              )}
            >
              {children}
            </p>
          </Link>
        </NavigationMenuLink>
      </li>
    );
  }
);
ListItem.displayName = "ListItem";

export function Header({
  withIsScrolled = true,
  glowPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
}: {
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
  withIsScrolled?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signer } = useEthersSigner();
  const { mintTestUSDC } = useForwarder(
    signer,
    Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  );
  const [isMintingTestUSDC, setIsMintingTestUSDC] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [withIsScrolled]);

  // Determine if we should apply scrolled styles
  const shouldApplyScrolledStyles = withIsScrolled && scrolled;

  return (
    <motion.header
      className={cn(
        "fixed w-full z-50 transition-all duration-300 px-6 md:px-12 xl:px-16",
        scrolled || !withIsScrolled ? "bg-transparent" : "bg-transparent"
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <GlowLockup
            className={cn(
              "w-24 md:w-36 h-12 relative z-10",
              !shouldApplyScrolledStyles && withIsScrolled && "text-white"
            )}
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-2">
          <NavigationMenu viewport={shouldApplyScrolledStyles}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors relative group text-base",
                    shouldApplyScrolledStyles || !withIsScrolled
                      ? "bg-transparent hover:bg-foreground hover:text-glow-white focus:bg-glow-light-grey focus:text-glow-black"
                      : "bg-transparent hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white text-white/90"
                  )}
                >
                  App
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  variant={
                    !shouldApplyScrolledStyles && withIsScrolled
                      ? "card"
                      : "default"
                  }
                >
                  <ul className="grid gap-3 p-6 md:w-[300px]">
                    <ListItem
                      href="https://app.glow.org?swap"
                      title="Swap"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Swap GLW, USDG, and more
                    </ListItem>
                    <ListItem
                      href="https://app.glow.org?liquidity"
                      title="Liquidity"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Add liquidity to the GLW/USDG pool and earn rewards
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <NavigationMenu viewport={shouldApplyScrolledStyles}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors relative group text-base",
                    shouldApplyScrolledStyles || !withIsScrolled
                      ? "bg-transparent hover:bg-foreground hover:text-glow-white focus:bg-glow-light-grey focus:text-glow-black"
                      : "bg-transparent hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white text-white/90"
                  )}
                >
                  Impact
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  variant={
                    !shouldApplyScrolledStyles && withIsScrolled
                      ? "card"
                      : "default"
                  }
                >
                  <ul className="grid gap-3 p-6 md:w-[250px]">
                    <ListItem
                      href="https://impact.glow.org"
                      title="Infrastructure projects"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      See the list of infrastructure projects
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <NavigationMenu viewport={shouldApplyScrolledStyles}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors relative group text-base",
                    shouldApplyScrolledStyles || !withIsScrolled
                      ? "bg-transparent hover:bg-foreground hover:text-glow-white focus:bg-foreground focus:text-glow-white"
                      : "bg-transparent hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white text-white/90"
                  )}
                >
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  variant={
                    !shouldApplyScrolledStyles && withIsScrolled
                      ? "card"
                      : "default"
                  }
                >
                  <ul className="grid gap-3 p-6 md:w-[250px]">
                    <ListItem
                      href="https://glow.org/blog"
                      title="Blog"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Latest news and insights
                    </ListItem>
                    <ListItem
                      href="https://glow.org/press"
                      title="Press"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Press releases and media coverage
                    </ListItem>
                    <ListItem
                      href="https://glow.org/branding"
                      title="Branding"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Brand assets and guidelines
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <NavigationMenu viewport={shouldApplyScrolledStyles}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors relative group text-base",
                    shouldApplyScrolledStyles || !withIsScrolled
                      ? "bg-transparent hover:bg-foreground hover:text-glow-white focus:bg-foreground focus:text-glow-white"
                      : "bg-transparent hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white text-white/90"
                  )}
                >
                  Audits
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  variant={
                    !shouldApplyScrolledStyles && withIsScrolled
                      ? "card"
                      : "default"
                  }
                >
                  <ul className="grid gap-3 p-6 md:w-[250px]">
                    <ListItem
                      href="https://glow.org/audits"
                      title="Audits"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Solar Farms Map
                    </ListItem>
                    <ListItem
                      href="https://glow.org/audits?view=list"
                      title="Audits"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Solar Farms List
                    </ListItem>
                    <ListItem
                      href="https://glow.org/gves"
                      title="GVEs"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Glow Verification Entities
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <NavigationMenu viewport={shouldApplyScrolledStyles}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors relative group text-base mr-6",
                    shouldApplyScrolledStyles || !withIsScrolled
                      ? "bg-transparent hover:bg-foreground hover:text-glow-white focus:bg-foreground focus:text-glow-white"
                      : "bg-transparent hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white text-white/90"
                  )}
                >
                  Data
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  variant={
                    !shouldApplyScrolledStyles && withIsScrolled
                      ? "card"
                      : "default"
                  }
                >
                  <ul className="grid gap-3 p-6 md:w-[300px]">
                    <ListItem
                      href="https://glow.org/archives"
                      title="Archives"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      Access historical data and records
                    </ListItem>
                    <ListItem
                      href="https://glow.org/weekly-reports"
                      title="Weekly Reports"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      View detailed weekly performance reports
                    </ListItem>
                    <ListItem
                      href="https://glow.org/rewards"
                      title="Rewards"
                      target="_blank"
                      shouldApplyScrolledStyles={
                        shouldApplyScrolledStyles || !withIsScrolled
                      }
                    >
                      View Farm Rewards
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div>
            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition-all duration-200",
                      shouldApplyScrolledStyles || !withIsScrolled
                        ? "bg-background/95 backdrop-blur-xl border-border hover:bg-muted/30 hover:border-border/60 text-foreground"
                        : "bg-white/5 backdrop-blur-xl border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                    )}
                    aria-label="Wallet menu"
                    title={address}
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-foreground/10 backdrop-blur-sm">
                      <Wallet className="w-3.5 h-3.5" />
                    </span>
                    <span
                      style={{ fontFamily: "Söhne, sans-serif" }}
                      className="font-medium"
                    >
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 backdrop-blur-xl bg-background/95 border-border"
                >
                  <DropdownMenuItem
                    onSelect={async (e) => {
                      e.preventDefault();
                      try {
                        await navigator.clipboard.writeText(address);
                        toast.success("Address copied");
                      } catch {
                        toast.error("Failed to copy");
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy address
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link
                      href={`/profile/${address}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <User className="w-4 h-4 mr-2" /> View profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      disconnect();
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <ConnectButton
                variant={
                  !scrolled && withIsScrolled ? "outline-white" : "default"
                }
                className="w-auto"
                size="small"
              />
            )}
          </div>
        </nav>

        {/* Mobile Menu Drawer */}
        <Drawer direction="right" shouldScaleBackground={false}>
          <DrawerTrigger asChild>
            <motion.button
              className={cn(
                "lg:hidden p-2 rounded-xl border border-border bg-background/80 backdrop-blur-sm hover:bg-secondary/80 transition-all duration-300 relative z-50",
                !shouldApplyScrolledStyles &&
                  withIsScrolled &&
                  "bg-white/10 border-white/20 text-white hover:bg-white/20"
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
                <DrawerClose asChild>
                  <motion.button
                    className="p-2 rounded-xl hover:bg-secondary/80 transition-colors"
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </DrawerClose>
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
                            href="https://app.glow.org?swap"
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              setTimeout(() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
                          >
                            Swap
                          </Link>
                        </DrawerClose>
                        <DrawerClose asChild>
                          <Link
                            href="https://app.glow.org?liquidity"
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              setTimeout(() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
                          >
                            Liquidity
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
                            onClick={() => {
                              setTimeout(() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
                          >
                            Infrastructure projects
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }, 100);
                            }}
                            className="block px-4 py-3 text-base rounded-lg hover:bg-secondary/80 transition-colors"
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
              {isConnected && address ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full inline-flex items-center justify-between rounded-2xl border px-4 py-3 bg-background/95 backdrop-blur-xl hover:bg-muted/30 hover:border-border/60 transition-all duration-200"
                      aria-label="Wallet menu"
                      title={address}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-foreground/10 backdrop-blur-sm">
                          <Wallet className="w-3.5 h-3.5" />
                        </span>
                        <span
                          style={{ fontFamily: "Söhne, sans-serif" }}
                          className="font-medium"
                        >
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-72 backdrop-blur-xl bg-background/95 border-border"
                  >
                    <DropdownMenuItem
                      onSelect={async (e) => {
                        e.preventDefault();
                        try {
                          await navigator.clipboard.writeText(address);
                          toast.success("Address copied");
                        } catch {
                          toast.error("Failed to copy");
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Copy className="w-4 h-4 mr-2" /> Copy address
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link
                        href={`/profile/${address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <User className="w-4 h-4 mr-2" /> View profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        disconnect();
                      }}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DrawerClose asChild>
                  <div>
                    <ConnectButton className="w-full" variant="default" />
                  </div>
                </DrawerClose>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </motion.header>
  );
}
