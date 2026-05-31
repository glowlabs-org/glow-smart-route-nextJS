"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Ticket,
  ShieldAlert,
  MessageSquare,
  Clock,
  Lock,
} from "lucide-react";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRaffle,
  type RaffleWalletStatus,
  type RaffleLifecycle,
} from "@/hooks/use-raffle";

const DL_STORAGE_KEY = "glow_raffle_dl";

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function RaffleEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();

  // The Discord OAuth callback redirects back with ?discord=linked&dl=<token>.
  // The dl token is required by POST /raffle/enter and is not stored server-side,
  // so keep it in component state (mirrored to sessionStorage for reloads).
  const [dlToken, setDlToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const urlDl = searchParams.get("dl");
    const discord = searchParams.get("discord");

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
      router.replace("/raffle", { scroll: false });
    }
  }, [searchParams, router]);

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

  // ---- Loading / empty states ----
  if (isLoadingStatus) {
    return (
      <Card className="rounded-[24px]">
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isStatusError) {
    return (
      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We couldn&apos;t load the raffle. Please refresh and try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const raffle = status?.raffle ?? null;
  const lifecycle = status?.status ?? null;
  const wallet = status?.wallet ?? null;

  if (!raffle) {
    return (
      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" /> Glow Raffle
          </CardTitle>
          <CardDescription>
            There is no active raffle right now. Check back soon.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const lifecycleBadge =
    lifecycle === "open" ? (
      <Badge variant="secondary" className="bg-green-500/15 text-green-600">
        Open
      </Badge>
    ) : lifecycle === "not_started" ? (
      <Badge variant="secondary">Not started</Badge>
    ) : (
      <Badge variant="secondary">Closed</Badge>
    );

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" /> {raffle.title}
          </CardTitle>
          {lifecycleBadge}
        </div>
        {raffle.description ? (
          <CardDescription>{raffle.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Requirement line */}
        <div className="rounded-xl border border-border/40 bg-muted/30 dark:bg-muted/50 p-3 text-sm text-muted-foreground">
          To enter you must have delegated <strong>GLW</strong> or{" "}
          <strong>sGCTL</strong>, and connect a Discord account.
        </div>

        {/* Not connected */}
        {!isConnected || !wallet ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to check eligibility and enter.
            </p>
            <ConnectButton variant="default" />
          </div>
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
      </CardContent>
    </Card>
  );
}

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

  // Already entered -> success state.
  if (wallet.entryStatus === "entered") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-semibold">You&apos;re entered.</span>
        </div>
        <dl className="rounded-xl border border-border/40 bg-muted/30 dark:bg-muted/50 p-3 text-sm">
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
        This wallet hasn&apos;t delegated GLW or sGCTL, so it isn&apos;t eligible.{" "}
        <a href="/launchpad" className="underline hover:text-foreground">
          Delegate on the Launchpad
        </a>{" "}
        and come back.
      </InfoBlock>
    );
  }

  // Eligible. Show eligibility badge + either Discord connect or Enter.
  const needsDiscord =
    wallet.entryStatus === "missing_discord" || !dlToken;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-muted-foreground">Eligible</span>
        {wallet.eligibilityAssets.map((asset) => (
          <Badge key={asset} variant="secondary">
            {asset}
          </Badge>
        ))}
      </div>

      {wallet.discordLinked && discordName ? (
        <p className="text-sm text-muted-foreground">
          Discord: <span className="text-foreground">{discordName}</span>
        </p>
      ) : null}

      {needsDiscord ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={onConnectDiscord}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {wallet.discordLinked ? "Continue with Discord" : "Connect Discord"}
          </Button>
          {wallet.discordLinked ? (
            <p className="text-xs text-muted-foreground">
              Reconnect Discord to confirm your account before entering.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
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
        </div>
      )}
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
    <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/30 dark:bg-muted/50 p-3 text-sm text-muted-foreground">
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
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/20 dark:border-border/40 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
