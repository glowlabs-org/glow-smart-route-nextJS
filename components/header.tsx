"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { isKolWallet } from "@/lib/kol";

import { GlowLockup } from "./glow-lockup";
import { SwapDialog } from "./dialogs/swap-dialog";
import { TosDialog } from "./tos-dialog";
import { ThemeToggle } from "./ui/theme-toggle";
import { WalletStatus } from "./wallet-status";
import { GlowSymbol } from "./glow-symbol";

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
            className,
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

function ActionListItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "block w-full select-none space-y-1 rounded-xl p-3 text-left leading-none no-underline outline-none transition-all duration-200",
          "hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100",
        )}
      >
        <div className="text-sm font-medium leading-none">{title}</div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </button>
    </li>
  );
}

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
            "p-2 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100",
            triggerClassName,
          )}
          whileTap={{ scale: 0.95 }}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </motion.button>
      </DrawerTrigger>

      <DrawerContent
        showHandle={false}
        className="fixed right-0 inset-y-0 h-screen w-80 max-w-[85vw] bg-card backdrop-blur-xl border-l border-border/20 dark:border-border/40"
      >
        <DrawerHeader className="border-b border-border/20 dark:border-border/40">
          <div className="flex items-center justify-between">
            <WalletStatus className="h-10" />
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
            Main navigation menu with links to different sections of the
            website.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-2">
            <div className="pt-4 border-t border-border/20 dark:border-border/40 mt-4">
              <div className="space-y-2">
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    App
                  </div>
                  <div className="ml-4 space-y-1">
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
  const { address } = useAccount();
  const showKolLink = isKolWallet(address);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = React.useState(false);

  const headerClassName = cn(
    "relative isolate z-50 h-[72px] w-full border-b border-border/40 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90",
    !withIsScrolled && "bg-transparent border-transparent backdrop-blur-0",
  );

  return (
    <>
      <header className={headerClassName}>
        <div className="mx-auto flex h-[72px] w-full max-w-screen-2xl items-center justify-between gap-6 px-6">
          <Link href="/" className="flex items-center space-x-2 group">
            <GlowSymbol className="w-10 md:w-12 shrink-0 relative z-10 text-zinc-900 dark:text-zinc-100" />
          </Link>

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-4">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    App
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[300px]">
                      <ListItem href="/" title="Home">
                        Back to the dashboard
                      </ListItem>
                      <ActionListItem
                        title="Swap"
                        description="Buy or swap tokens without leaving the app"
                        onClick={() => setIsSwapDialogOpen(true)}
                      />
                      <ListItem href="/stats/rewards" title="Glow Leaderboard">
                        View top wallets and rewards leaderboard
                      </ListItem>
                      <ListItem href="/stats" title="Protocol Stats">
                        Real-time protocol metrics and market data
                      </ListItem>
                      {showKolLink && (
                        <ListItem href="/ambassador" title="Ambassador Dashboard">
                          Commission tracking and performance
                        </ListItem>
                      )}
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
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
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
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle />
            <WalletStatus />
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <WalletStatus />
            <Drawer direction="right" shouldScaleBackground={false}>
              <DrawerTrigger asChild>
                <motion.button
                  className="p-2 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100"
                  whileTap={{ scale: 0.95 }}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </motion.button>
              </DrawerTrigger>

              <DrawerContent
                showHandle={false}
                className="fixed right-0 inset-y-0 h-screen w-80 max-w-[85vw] bg-card backdrop-blur-xl border-l border-border/20 dark:border-border/40"
              >
                <DrawerHeader className="border-b border-border/20 dark:border-border/40">
                  <div className="flex items-center justify-between">
                    <WalletStatus className="h-10" />
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
                    Main navigation menu with links to different sections of the
                    website.
                  </DrawerDescription>
                </DrawerHeader>

                <div className="p-6 flex-1 overflow-y-auto">
                  <nav className="space-y-2">
                    <div className="pt-4 border-t border-border/20 dark:border-border/40 mt-4">
                      <div className="space-y-2">
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            App
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="/"
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
                                Home
                              </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  setTimeout(() => {
                                    setIsSwapDialogOpen(true);
                                  }, 0);
                                }}
                                className="block w-full px-4 py-3 text-left text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                Swap
                              </button>
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
                            {showKolLink && (
                              <DrawerClose asChild>
                                <Link
                                  href="/ambassador"
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
                                  Ambassador Dashboard
                                </Link>
                              </DrawerClose>
                            )}
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
          </div>
        </div>
      </header>

      <SwapDialog
        open={isSwapDialogOpen}
        onOpenChange={setIsSwapDialogOpen}
      />
      <TosDialog />
    </>
  );
}
