"use client";

import * as React from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Ticket,
  ShieldAlert,
  MessageSquare,
  Clock,
  Lock,
  ShieldCheck,
  ExternalLink,
  PartyPopper,
  BadgeCheck,
} from "lucide-react";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRaffle,
  type PublicRaffle,
  type RaffleWalletStatus,
  type RaffleLifecycle,
} from "@/hooks/use-raffle";

const DL_STORAGE_KEY = "glow_raffle_dl";

// Surface tokens — the palette is light, so bg tints read flat; rely on real
// borders to give cards definition in both themes.
const CARD = "rounded-3xl border border-border bg-card";
const TILE = "rounded-2xl border border-border bg-muted/60 dark:bg-muted/40";

// Per-slug hero art fallback while the backend `imageUrl` field rolls out.
const RAFFLE_FALLBACK_IMAGES: Record<string, string> = {
  "inkblot-genetics-wl": "/raffles/inkblot-genetics.jpg",
};

// Presentational per-raffle metadata. Centralized here (like the image fallback)
// until these become first-class backend fields, so adding a raffle is one entry
// here + the backend row — no layout edits.
type RaffleMeta = {
  spots?: number;
  mintPrice?: string;
  mintDate?: string;
  project?: string;
  projectUrl?: string;
};
const RAFFLE_META: Record<string, RaffleMeta> = {
  "inkblot-genetics-wl": {
    spots: 3,
    mintPrice: "~0.009 ETH",
    mintDate: "June 3",
    project: "Inkblot Genetics",
    projectUrl: "https://inkblotgenetics.com",
  },
};

// `imageUrl` is an optional, possibly-undefined field on the public raffle.
type RaffleWithImage = PublicRaffle & { imageUrl?: string | null };

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function chainName(id?: number): string {
  if (id === 1) return "Ethereum";
  if (id === 8453) return "Base";
  if (id === 11155111) return "Sepolia";
  return id ? `Chain ${id}` : "Ethereum";
}

function resolveHeroImage(raffle: RaffleWithImage): string | null {
  return raffle.imageUrl ?? RAFFLE_FALLBACK_IMAGES[raffle.slug] ?? null;
}

// ---- Top-level component --------------------------------------------------

export function RaffleEntry() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { ready: privyReady } = usePrivy();
  // While Privy hydrates / wagmi auto-reconnects after a reload, we don't yet
  // know whether a wallet is connected. Treat that as loading so we don't flash
  // the "connect wallet" UI before the eligible/entered state resolves.
  const walletInitializing = !privyReady || isConnecting || isReconnecting;

  // The Discord OAuth callback redirects back with ?discord=linked&dl=<token>.
  // The dl token is required by POST /raffle/enter and is not stored server-side,
  // so keep it in component state (mirrored to sessionStorage for reloads).
  const [dlToken, setDlToken] = React.useState<string | null>(null);

  // Handle the Discord callback params exactly once, then strip them from the URL
  // with history.replaceState so a reload can never replay the toast.
  const processedParamsRef = React.useRef(false);
  React.useEffect(() => {
    if (processedParamsRef.current) return;
    processedParamsRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlDl = params.get("dl");
    const discord = params.get("discord");

    if (urlDl) {
      setDlToken(urlDl);
      try {
        sessionStorage.setItem(DL_STORAGE_KEY, urlDl);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
    } else {
      try {
        const stored = sessionStorage.getItem(DL_STORAGE_KEY);
        if (stored) setDlToken(stored);
      } catch {
        // ignore
      }
    }

    if (discord === "linked") toast.success("Discord connected");
    else if (discord === "denied") toast.error("Discord connection cancelled");
    else if (discord === "conflict")
      toast.error("That Discord account is already linked to another wallet");
    else if (discord === "error")
      toast.error("Discord connection failed, please try again");

    if (urlDl || discord) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const { status, isLoadingStatus, isStatusError, enter, isEntering } =
    useRaffle({ discordLinkToken: dlToken });

  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL;

  const connectDiscord = React.useCallback(() => {
    if (!address) return;
    if (!hubUrl) {
      toast.error("Raffle is not configured");
      return;
    }
    window.location.href = `${hubUrl}/discord/authorize?walletAddress=${address}`;
  }, [address, hubUrl]);

  // ---- Loading state (status fetch OR wallet still reconnecting) ----
  if (isLoadingStatus || walletInitializing) {
    return (
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-5 lg:col-span-5">
          <Skeleton className="aspect-video w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
        <div className="space-y-5 lg:col-span-7">
          <Skeleton className="h-9 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-44 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (isStatusError) {
    return (
      <CenteredCard title="Something went wrong">
        We couldn&apos;t load the raffle. Please refresh and try again.
      </CenteredCard>
    );
  }

  const raffle = (status?.raffle ?? null) as RaffleWithImage | null;
  const lifecycle = status?.status ?? null;
  const wallet = status?.wallet ?? null;

  // ---- No active raffle ----
  if (!raffle) {
    return (
      <CenteredCard title="No active raffle" icon={<Ticket className="h-5 w-5" />}>
        There is no active raffle right now. Check back soon.
      </CenteredCard>
    );
  }

  const heroImage = resolveHeroImage(raffle);
  const meta = RAFFLE_META[raffle.slug] ?? {};

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-10">
      {/* Artwork + details: left column on desktop, BELOW the CTA on mobile. */}
      <div className="order-2 space-y-5 lg:order-1 lg:col-span-5">
        <ArtCard src={heroImage} alt={raffle.title} meta={meta} />
        <DetailsCard raffle={raffle} meta={meta} />
      </div>

      {/* Heading / status / action: right column on desktop, FIRST on mobile so
          the CTA is above the fold. Description sits under the title on desktop
          but drops below the CTA on mobile (order-4). */}
      <div className="order-1 flex flex-col gap-5 lg:order-2 lg:col-span-7">
        <header className="order-1 space-y-3 lg:order-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-delegation-purple">
              Whitelist Raffle
            </span>
            <LifecycleBadge lifecycle={lifecycle} />
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            {raffle.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-foreground">Glow</span>{" "}
            · Open to delegators
          </p>
        </header>

        {raffle.description ? (
          <p className="order-4 text-sm leading-relaxed text-muted-foreground lg:order-none">
            {raffle.description}
          </p>
        ) : null}

        <div className="order-2 lg:order-none">
          <StatusStrip lifecycle={lifecycle} meta={meta} />
        </div>

        <div className="order-3 lg:order-none">
          {!isConnected || !wallet ? (
            <ActionCard accent>
              <ActionHeading step={1}>Connect your wallet</ActionHeading>
              <p className="text-sm text-muted-foreground">
                We&apos;ll check that it has delegated GLW or sGCTL.
              </p>
              <ConnectButton variant="default" />
              <Steps current={1} discordLinked={false} />
            </ActionCard>
          ) : (
            <WalletSection
              wallet={wallet}
              lifecycle={lifecycle}
              dlToken={dlToken}
              isEntering={isEntering}
              onConnectDiscord={connectDiscord}
              onEnter={() => enter()}
            />
          )}
        </div>
      </div>

      {/* Footer note: full width, last on both layouts. */}
      <p className="order-3 text-center text-xs text-muted-foreground/70 lg:order-none lg:col-span-12">
        Winners are drawn after the raffle closes and announced in the Glow
        Discord.
      </p>
    </div>
  );
}

// ---- Left column ----------------------------------------------------------

function ArtCard({
  src,
  alt,
  meta,
}: {
  src: string | null;
  alt: string;
  meta: RaffleMeta;
}) {
  return (
    <div className={`overflow-hidden ${CARD}`}>
      <div className="relative aspect-video w-full bg-zinc-950">
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 460px"
            className="object-cover object-center"
          />
        ) : (
          <HeroPlaceholder />
        )}
      </div>

      {/* Collection footer — gives the art a collectible-card identity. */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-border">
          {src ? (
            <Image src={src} alt="" fill sizes="36px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-medium text-foreground">
            <span className="truncate">{meta.project ?? "NFT Collection"}</span>
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-delegation-purple" />
          </div>
          <div className="text-xs text-muted-foreground">NFT mint</div>
        </div>
        {meta.projectUrl ? (
          <a
            href={meta.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-delegation-purple hover:text-delegation-purple"
            aria-label="View collection"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DetailsCard({
  raffle,
  meta,
}: {
  raffle: RaffleWithImage;
  meta: RaffleMeta;
}) {
  const items: { label: string; value: string }[] = [];
  if (meta.spots) {
    items.push({ label: "Prize", value: `${meta.spots} whitelist spots` });
  }
  if (meta.mintPrice) items.push({ label: "Mint price", value: meta.mintPrice });
  if (meta.mintDate) items.push({ label: "Mint date", value: meta.mintDate });
  items.push({ label: "Network", value: chainName(raffle.allowedChainIds?.[0]) });
  items.push({ label: "Eligibility", value: "GLW / sGCTL" });

  return (
    <div className={`p-5 ${CARD}`}>
      <h2 className="text-sm font-semibold text-foreground">Details</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className={`p-3 ${TILE}`}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---- Right column ---------------------------------------------------------

function LifecycleBadge({ lifecycle }: { lifecycle: RaffleLifecycle | null }) {
  if (lifecycle === "open") {
    return (
      <Badge
        variant="secondary"
        className="border border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400"
      >
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        Open
      </Badge>
    );
  }
  if (lifecycle === "not_started") {
    return (
      <Badge variant="secondary" className="border border-border">
        <Clock className="h-3 w-3" /> Soon
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="border border-border">
      <Lock className="h-3 w-3" /> Closed
    </Badge>
  );
}

function StatusStrip({
  lifecycle,
  meta,
}: {
  lifecycle: RaffleLifecycle | null;
  meta: RaffleMeta;
}) {
  const statusLabel =
    lifecycle === "open"
      ? "Open"
      : lifecycle === "not_started"
      ? "Not started"
      : "Closed";

  return (
    <div className={`grid grid-cols-3 divide-x divide-border ${CARD}`}>
      <Stat label="Status">
        <span className="inline-flex items-center gap-1.5">
          {lifecycle === "open" ? (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          ) : null}
          {statusLabel}
        </span>
      </Stat>
      <Stat label="Mints">{meta.mintDate ?? "TBA"}</Stat>
      <Stat label="Spots">
        <span className="text-delegation-purple">{meta.spots ?? "—"}</span>
      </Stat>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">
        {children}
      </div>
    </div>
  );
}

// The primary action surface. `accent` adds a subtle delegation-purple glow so
// the CTA leads the eye (house pattern: tight negative-spread colored shadow).
function ActionCard({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  const toneClass = accent
    ? "border-delegation-purple/30 bg-card"
    : "border-border bg-card";
  return (
    <div className={`space-y-4 rounded-3xl border p-5 ${toneClass}`}>
      {children}
    </div>
  );
}

function ActionHeading({
  step,
  children,
}: {
  step?: number;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
      {step ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
          {step}
        </span>
      ) : null}
      {children}
    </h3>
  );
}

// Compact 3-step progress hint for production-feel onboarding.
function Steps({
  current,
  discordLinked,
}: {
  current: 1 | 2 | 3;
  discordLinked: boolean;
}) {
  const steps = ["Connect wallet", "Link Discord", "Sign to enter"];
  return (
    <ol className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current || (n === 2 && discordLinked && current > 2);
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                active
                  ? "font-medium text-foreground"
                  : done
                  ? "text-foreground/70"
                  : ""
              }
            >
              {n}. {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="text-muted-foreground/40">›</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---- Wallet / entry states ------------------------------------------------

function WalletSection({
  wallet,
  lifecycle,
  dlToken,
  isEntering,
  onConnectDiscord,
  onEnter,
}: {
  wallet: RaffleWalletStatus | null;
  lifecycle: RaffleLifecycle | null;
  dlToken: string | null;
  isEntering: boolean;
  onConnectDiscord: () => void;
  onEnter: () => void;
}) {
  if (!wallet) return null;

  const discordName =
    wallet.discord?.globalName || wallet.discord?.username || wallet.discord?.id;

  // Already entered -> soft-green success card with a small entry stub.
  if (wallet.entryStatus === "entered") {
    return (
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex items-start justify-between gap-4 border-b border-border bg-green-500/10 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <PartyPopper className="h-5 w-5" />
              <span className="text-base font-semibold">You&apos;re entered</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your spot in the draw is locked in. Winners are announced in the
              Glow Discord.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
        <dl className="p-5 text-sm">
          <Row label="Discord">{discordName ?? "—"}</Row>
          <Row label="Wallet">{shortAddress(wallet.address)}</Row>
          {wallet.entry ? (
            <Row label="Entry ID">
              <span className="font-mono text-xs">{wallet.entry.id}</span>
            </Row>
          ) : null}
        </dl>
      </div>
    );
  }

  if (lifecycle === "not_started") {
    return (
      <InfoBlock icon={<Clock className="h-5 w-5" />}>
        This raffle hasn&apos;t started yet. Check back soon.
      </InfoBlock>
    );
  }

  if (lifecycle === "closed" || wallet.entryStatus === "closed") {
    return (
      <InfoBlock icon={<Lock className="h-5 w-5" />}>
        This raffle is closed. Entries are no longer accepted.
      </InfoBlock>
    );
  }

  if (wallet.entryStatus === "ineligible") {
    return (
      <InfoBlock icon={<ShieldAlert className="h-5 w-5" />}>
        This wallet hasn&apos;t delegated GLW or sGCTL, so it isn&apos;t
        eligible.{" "}
        <a href="/launchpad" className="font-medium text-foreground underline">
          Delegate on the Launchpad
        </a>{" "}
        and come back.
      </InfoBlock>
    );
  }

  // Eligible -> connect Discord, or enter.
  const needsDiscord = wallet.entryStatus === "missing_discord" || !dlToken;

  return (
    <ActionCard accent>
      {/* Eligibility confirmation */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Eligible
        </span>
        <span className="text-xs text-muted-foreground">via</span>
        {wallet.eligibilityAssets.map((asset) => (
          <Badge
            key={asset}
            variant="secondary"
            className="border border-delegation-purple/30 bg-delegation-purple/10 font-mono text-delegation-purple"
          >
            {asset}
          </Badge>
        ))}
      </div>

      {needsDiscord ? (
        <>
          <ActionHeading step={2}>Link your Discord</ActionHeading>
          <p className="text-sm text-muted-foreground">
            {wallet.discordLinked
              ? "Reconnect Discord to confirm your account before entering."
              : "Connect the Discord account you want the whitelist spot on."}
          </p>
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={onConnectDiscord}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {wallet.discordLinked ? "Continue with Discord" : "Connect Discord"}
          </Button>
          <Steps current={2} discordLinked={wallet.discordLinked} />
        </>
      ) : (
        <>
          {wallet.discordLinked && discordName ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              Discord:{" "}
              <span className="font-medium text-foreground">{discordName}</span>
            </p>
          ) : null}
          <ActionHeading step={3}>Sign to enter</ActionHeading>
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={onEnter}
            disabled={isEntering}
          >
            {isEntering ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Ticket className="mr-2 h-4 w-4" />
            )}
            {isEntering ? "Confirm in your wallet..." : "Enter Raffle"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You&apos;ll only be asked to sign a message. This does not send a
            transaction, approve tokens, transfer funds, or give anyone access
            to your wallet. Never share your seed phrase or private key.
          </p>
        </>
      )}
    </ActionCard>
  );
}

// ---- Small shared pieces --------------------------------------------------

function HeroPlaceholder() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-tr from-delegation-purple/30 via-transparent to-glow-orange/20"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Ticket className="h-12 w-12 text-white/20" />
      </div>
    </div>
  );
}

function CenteredCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto max-w-md p-8 text-center ${CARD}`}>
      <div className="flex items-center justify-center gap-2 text-foreground">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function InfoBlock({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 p-5 text-sm text-muted-foreground ${CARD}`}>
      <span className="mt-0.5 text-foreground">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
