"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
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
import { useLang } from "@/lib/i18n";

import { GlowLockup } from "./glow-lockup";
import { SwapDialog } from "./dialogs/swap-dialog";
import { TosDialog } from "./tos-dialog";
import { WhatsNewModal } from "./whats-new-modal";
import { useReferral } from "@/hooks/use-referral";
import { useTosStatus } from "@/hooks/use-tos-status";
import { hubPost } from "@/lib/api/hub-client";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "./ui/theme-toggle";
import { LangToggle } from "./lang-toggle";
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
  const { t } = useLang();
  return (
    <Drawer direction="right" shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <motion.button
          className={cn(
            "p-2 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100",
            triggerClassName,
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={t.header.openMenu}
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
              <LangToggle />
              <ThemeToggle />
              <DrawerClose asChild>
                <motion.button
                  className="p-2 rounded-xl hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                  whileTap={{ scale: 0.95 }}
                  aria-label={t.header.closeMenu}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </DrawerClose>
            </div>
          </div>
          <DrawerTitle className="sr-only">{t.header.navigationMenuTitle}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {t.header.navigationMenuDescription}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-2">
            <div className="pt-4 border-t border-border/20 dark:border-border/40 mt-4">
              <div className="space-y-2">
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t.header.sections.app}
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
                        {t.header.leaderboard.title}                      </Link>
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
                        {t.header.protocolStats.title}                      </Link>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Link
                        href="/shop"
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
                        Points Shop
                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t.header.sections.impact}
                  </div>
                  <div className="ml-4 space-y-1">
                    <DrawerClose asChild>
                      <Link
                        href="https://impact.glow.org"
                        target="_blank"
                        rel="noreferrer"
                        className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                      >
                        {t.header.infrastructureProjects.title}                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t.header.sections.resources}
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
                        {t.header.blog.title}                      </Link>
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
                        {t.header.press.title}                      </Link>
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
                        {t.header.branding.title}                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t.header.sections.audits}
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
                        {t.header.solarFarmsMap.title}                      </Link>
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
                        {t.header.solarFarmsList.title}                      </Link>
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
                        {t.header.gves.description}                      </Link>
                    </DrawerClose>
                  </div>
                </div>

                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t.header.sections.data}
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
                        {t.header.archives.title}                      </Link>
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
                        {t.header.weeklyReports.title}                      </Link>
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
                        {t.header.rewards.title}                      </Link>
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
  const { t } = useLang();
  const { address } = useAccount();
  const showKolLink = isKolWallet(address);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = React.useState(false);

  // What's New modal: auto-shows once until the wallet has gone through every
  // slide (reuses the feature-launch "seen" flag), and is always re-openable
  // from the button below.
  const [isWhatsNewOpen, setIsWhatsNewOpen] = React.useState(false);
  const { status: referralStatus } = useReferral();
  const { hasAcceptedTos } = useTosStatus(address);
  const queryClient = useQueryClient();
  const hasSeenWhatsNew = !!referralStatus?.featureLaunchModal?.seen;
  const autoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoOpenedRef.current) return;
    if (address && hasAcceptedTos && referralStatus && !hasSeenWhatsNew) {
      autoOpenedRef.current = true;
      setIsWhatsNewOpen(true);
    }
  }, [address, hasAcceptedTos, referralStatus, hasSeenWhatsNew]);
  const markWhatsNewSeen = React.useCallback(async () => {
    if (!address) return;
    try {
      await hubPost("/referral/feature-launch-seen", { walletAddress: address });
      queryClient.invalidateQueries({ queryKey: ["referral-status", address] });
    } catch {
      // non-fatal: the modal can re-show next visit
    }
  }, [address, queryClient]);

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
                    {t.header.sections.app}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[300px]">
                      <ListItem href="/" title={t.header.home.title}>
                        {t.header.home.description}                      </ListItem>
                      <ActionListItem
                        title={t.header.swap.title}
                        description={t.header.swap.description}
                        onClick={() => setIsSwapDialogOpen(true)}
                      />
                      <ListItem href="/stats/rewards" title={t.header.leaderboard.title}>
                        {t.header.leaderboard.description}
                      </ListItem>
                      <ListItem href="/stats" title={t.header.protocolStats.title}>
                        {t.header.protocolStats.description}
                      </ListItem>
                      <ListItem href="/shop" title={t.header.pointsShop.title}>
                        {t.header.pointsShop.description}
                      </ListItem>
                      {showKolLink && (
                        <ListItem href="/ambassador" title={t.header.ambassadorDashboard.title}>
                          {t.header.ambassadorDashboard.description}                        </ListItem>
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
                    {t.header.sections.impact}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://impact.glow.org"
                        title={t.header.infrastructureProjects.title}
                      >
                        {t.header.infrastructureProjects.description}                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    {t.header.sections.resources}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://glow.org/blog"
                        title={t.header.blog.title}
                        target="_blank"
                      >
                        {t.header.blog.description}                      </ListItem>
                      <ListItem
                        href="https://glow.org/press"
                        title={t.header.press.title}
                        target="_blank"
                      >
                        {t.header.press.description}                      </ListItem>
                      <ListItem
                        href="https://glow.org/branding"
                        title={t.header.branding.title}
                        target="_blank"
                      >
                        {t.header.branding.description}                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    {t.header.sections.audits}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[250px]">
                      <ListItem
                        href="https://glow.org/audits"
                        title={t.header.solarFarmsMap.title}
                        target="_blank"
                      >
                        {t.header.solarFarmsMap.title}                      </ListItem>
                      <ListItem
                        href="https://glow.org/audits?view=list"
                        title={t.header.solarFarmsList.title}
                        target="_blank"
                      >
                        {t.header.solarFarmsList.title}                      </ListItem>
                      <ListItem
                        href="https://glow.org/gves"
                        title={t.header.gves.title}
                        target="_blank"
                      >
                        {t.header.gves.description}                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-zinc-900 dark:text-zinc-100 transition-colors relative group text-base bg-transparent hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 focus:bg-foreground focus:text-background dark:focus:bg-accent/10 dark:focus:text-zinc-100 data-[state=open]:bg-foreground data-[state=open]:text-background dark:data-[state=open]:bg-accent/10 dark:data-[state=open]:text-zinc-100">
                    {t.header.sections.data}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[300px]">
                      <ListItem
                        href="https://glow.org/archives"
                        title={t.header.archives.title}
                        target="_blank"
                      >
                        {t.header.archives.description}                      </ListItem>
                      <ListItem
                        href="https://glow.org/weekly-reports"
                        title={t.header.weeklyReports.title}
                        target="_blank"
                      >
                        {t.header.weeklyReports.description}                      </ListItem>
                      <ListItem
                        href="https://glow.org/rewards"
                        title={t.header.rewards.title}
                        target="_blank"
                      >
                        {t.header.rewards.description}                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWhatsNewOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100"
            >
              <Sparkles className="h-4 w-4" />
              What&apos;s new
            </button>
            <LangToggle />
            <ThemeToggle />
            <WalletStatus />
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setIsWhatsNewOpen(true)}
              aria-label="What's new"
              className="p-2 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
            </button>
            <LangToggle />
            <WalletStatus />
            <Drawer direction="right" shouldScaleBackground={false}>
              <DrawerTrigger asChild>
                <motion.button
                  className="p-2 rounded-xl border border-border/20 dark:border-border/40 bg-background/80 backdrop-blur-sm hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-all duration-300 relative z-50 text-zinc-900 dark:text-zinc-100"
                  whileTap={{ scale: 0.95 }}
                  aria-label={t.header.openMenu}
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
                          aria-label={t.header.closeMenu}
                        >
                          <X className="h-5 w-5" />
                        </motion.button>
                      </DrawerClose>
                    </div>
                  </div>
                  <DrawerTitle className="sr-only">
                    {t.header.navigationMenuTitle}
                  </DrawerTitle>
                  <DrawerDescription className="sr-only">
                    {t.header.navigationMenuDescription}
                  </DrawerDescription>
                </DrawerHeader>

                <div className="p-6 flex-1 overflow-y-auto">
                  <nav className="space-y-2">
                    <div className="pt-4 border-t border-border/20 dark:border-border/40 mt-4">
                      <div className="space-y-2">
                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t.header.sections.app}
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
                                {t.header.home.title}                              </Link>
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
                                {t.header.swap.title}                              </button>
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
                                {t.header.leaderboard.title}                              </Link>
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
                                {t.header.protocolStats.title}                              </Link>
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
                                  {t.header.ambassadorDashboard.title}                                </Link>
                              </DrawerClose>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t.header.sections.impact}
                          </div>
                          <div className="ml-4 space-y-1">
                            <DrawerClose asChild>
                              <Link
                                href="https://impact.glow.org"
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 text-base rounded-lg hover:bg-foreground hover:text-background dark:hover:bg-accent/10 dark:hover:text-zinc-100 transition-colors"
                              >
                                {t.header.infrastructureProjects.title}                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t.header.sections.resources}
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
                                {t.header.blog.title}                              </Link>
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
                                {t.header.press.title}                              </Link>
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
                                {t.header.branding.title}                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t.header.sections.audits}
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
                                {t.header.solarFarmsMap.title}                              </Link>
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
                                {t.header.solarFarmsList.title}                              </Link>
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
                                {t.header.gves.description}                              </Link>
                            </DrawerClose>
                          </div>
                        </div>

                        <div>
                          <div className="px-4 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t.header.sections.data}
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
                                {t.header.archives.title}                              </Link>
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
                                {t.header.weeklyReports.title}                              </Link>
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
                                {t.header.rewards.title}                              </Link>
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
      <WhatsNewModal
        open={isWhatsNewOpen}
        onOpenChange={setIsWhatsNewOpen}
        onComplete={markWhatsNewSeen}
      />
    </>
  );
}
