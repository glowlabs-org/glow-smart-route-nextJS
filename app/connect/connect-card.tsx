"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { Loader2, PenLine, Check, ArrowRight } from "lucide-react";

import { ConnectButton } from "@/components/connect-button";
import { GlowSymbol } from "@/components/glow-symbol";
import {
  useDiscordLink,
  useFlexPreview,
  useLeaderboardPreview,
  type FlexMetric,
  type FlexPreviewStats,
  type LeaderboardPreviewResponse,
  type LeaderboardPreviewRow,
} from "@/hooks/use-discord-link";
import { shortAddress } from "@/utils/impact";
import { cn } from "@/lib/utils";

const DL_STORAGE_KEY = "glow_connect_dl";
const DISCORD_NAME_STORAGE_KEY = "glow_connect_discord_name";
const BLURPLE = "#5865F2";

// Discord mock palette — flips between Discord's light and dark themes with the
// site theme (class-based dark mode), so the preview reads as a real Discord
// screenshot in either mode instead of a hardcoded dark block on a light page.
const DC = {
  chat: "bg-[#f2f3f5] dark:bg-[#313338]",
  embed:
    "bg-white dark:bg-[#2B2D31] border border-black/[0.06] dark:border-transparent",
  chip: "bg-[#e3e5e8] dark:bg-[#1E1F22]",
  header: "text-[#060607] dark:text-[#f2f3f5]", // bold / primary
  normal: "text-[#2e3338] dark:text-[#dbdee1]", // body text
  label: "text-[#4e5058] dark:text-[#b5bac1]", // field labels
  muted: "text-[#5c5e66] dark:text-[#949ba4]", // timestamps / footer
  skeleton: "bg-black/10 dark:bg-white/10",
} as const;

function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
    </svg>
  );
}

// Mirror the bot's flex.js formatting exactly (toLocaleString, 2 dp).
function fmtNum(value: string | undefined): string {
  const n = Number.parseFloat(value || "0");
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtGlw(wei: string | undefined): string {
  try {
    const n = Number.parseFloat(formatUnits(BigInt(wei || "0"), 18));
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  } catch {
    return "0";
  }
}

// True when the wallet has GLW in launchpad fractions still filling (pending).
function hasPendingGlw(wei: string | undefined): boolean {
  try {
    return BigInt(wei || "0") > 0n;
  } catch {
    return false;
  }
}

// The metric that produced the best rank, labeled as Luna prints it.
function metricLabel(metric: FlexMetric): string {
  if (metric === "watts") return "Power";
  if (metric === "carbon") return "Carbon";
  return "Vault";
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-sm leading-relaxed">
      <span className={cn("shrink-0", DC.label)}>{label}</span>
      <span className={cn("min-w-0 truncate font-medium", DC.header)}>{value}</span>
    </div>
  );
}

function StatRowSkeleton({ label, w }: { label: string; w: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm leading-relaxed">
      <span className={cn("shrink-0", DC.label)}>{label}</span>
      <span
        className={cn("h-3.5 animate-pulse self-center rounded", w, DC.skeleton)}
      />
    </div>
  );
}

// ---- Shared Discord chrome --------------------------------------------------
// All three previews reuse a real-Discord look: Luna's bot message header, the
// glow-yellow-accented embed body, and the glow.org footer. Hardcoded Discord
// dark-theme hexes so the mock reads as a screenshot regardless of site theme.

function LunaHeader({ now }: { now: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="glow-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <GlowSymbol className="h-5 w-5 !text-black" />
      </span>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn("text-sm font-semibold", DC.header)}>Luna</span>
        <span
          className="rounded px-1 py-px text-[9px] font-bold uppercase leading-tight text-white"
          style={{ backgroundColor: BLURPLE }}
        >
          App
        </span>
        <span className={cn("text-[11px]", DC.muted)}>Today at {now || "now"}</span>
      </div>
    </div>
  );
}

function EmbedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("mt-1.5 flex overflow-hidden rounded-[4px]", DC.embed)}>
      <div className="w-1 shrink-0 bg-[#FFD60A]" />
      <div className="min-w-0 flex-1 px-3 py-2.5">{children}</div>
    </div>
  );
}

function GlowFooter({ extra }: { extra?: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <span className="glow-gradient flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full">
        <GlowSymbol className="h-2 w-2 !text-black" />
      </span>
      <span className={cn("text-[11px]", DC.muted)}>
        glow.org{extra ? ` · ${extra}` : ""}
      </span>
    </div>
  );
}

// Blurple Discord @mention pill (light/dark variants).
function MentionPill({ name }: { name: string }) {
  return (
    <span className="rounded bg-[#5865F2]/15 px-1 font-medium text-[#4752c4] dark:bg-[#5865F2]/30 dark:text-[#C9CDFB]">
      @{name}
    </span>
  );
}

// A user's typed message (initial-avatar + name + the command), shown above
// Luna's reply in the !wallets preview to convey "run this on anyone".
function UserCommandBubble({
  name,
  now,
  command,
}: {
  name: string;
  now: string;
  command: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d6d9dc] text-sm font-semibold text-[#4e5058] dark:bg-[#4E5058] dark:text-white">
        {(name[0] || "?").toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", DC.header)}>{name}</span>
          <span className={cn("text-[11px]", DC.muted)}>
            Today at {now || "now"}
          </span>
        </div>
        <div className={cn("text-sm", DC.normal)}>{command}</div>
      </div>
    </div>
  );
}

// ---- !flex / !wallets embed body --------------------------------------------

function FlexEmbedBody({
  name,
  stats,
  loading,
}: {
  name: string | null;
  stats: FlexPreviewStats | undefined;
  loading: boolean;
}) {
  const best = stats?.bestRank;
  return (
    <>
      <div className="space-y-0.5">
        <StatRow label="User:" value={name || "You"} />
        {loading ? (
          <>
            <StatRowSkeleton label="Vault:" w="w-28" />
            <StatRowSkeleton label="Total Power:" w="w-24" />
            <StatRowSkeleton label="Total Carbon:" w="w-20" />
          </>
        ) : (
          <>
            <StatRow label="Vault:" value={`${fmtGlw(stats?.vaultedGlwWei)} GLW`} />
            {hasPendingGlw(stats?.pendingGlwWei) ? (
              <StatRow
                label="Pending:"
                value={`${fmtGlw(stats?.pendingGlwWei)} GLW`}
              />
            ) : null}
            <StatRow
              label="Total Power:"
              value={`${fmtNum(stats?.totalWatts)} watts`}
            />
            <StatRow
              label="Total Carbon:"
              value={`${fmtNum(stats?.totalCarbonCredits)} tons`}
            />
          </>
        )}
      </div>
      <div className="mt-2.5">
        {loading ? (
          <StatRowSkeleton label="Best rank:" w="w-16" />
        ) : (
          <StatRow
            label="Best rank:"
            value={best ? `${best.rank} (${metricLabel(best.metric)})` : "Unranked"}
          />
        )}
      </div>
      <GlowFooter />
    </>
  );
}

function FlexMessage(props: {
  name: string | null;
  stats: FlexPreviewStats | undefined;
  loading: boolean;
  now: string;
}) {
  return (
    <>
      <LunaHeader now={props.now} />
      <EmbedShell>
        <FlexEmbedBody name={props.name} stats={props.stats} loading={props.loading} />
      </EmbedShell>
    </>
  );
}

function WalletsMessage(props: {
  name: string | null;
  stats: FlexPreviewStats | undefined;
  loading: boolean;
  now: string;
}) {
  const handle = props.name || "user";
  return (
    <div className="space-y-3">
      <UserCommandBubble
        name={handle}
        now={props.now}
        command={
          <span className="font-mono">
            !wallets <MentionPill name={handle} />
          </span>
        }
      />
      <div>
        <LunaHeader now={props.now} />
        <EmbedShell>
          <FlexEmbedBody
            name={props.name}
            stats={props.stats}
            loading={props.loading}
          />
        </EmbedShell>
      </div>
    </div>
  );
}

// ---- !leaderboard embed body ------------------------------------------------

function leaderboardRowValue(
  row: LeaderboardPreviewRow,
  metric: FlexMetric,
): string {
  if (metric === "watts") return `${fmtNum(row.totalWatts)} watts`;
  if (metric === "carbon") return `${fmtNum(row.totalCarbonCredits)} tons`;
  return `${fmtGlw(row.vaultedGlwWei)} GLW`;
}

function LeaderboardRowItem({
  row,
  metric,
}: {
  row: LeaderboardPreviewRow;
  metric: FlexMetric;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded px-1.5 py-1 text-sm",
        row.isYou && "bg-[#FFD60A]/20 dark:bg-[#FFD60A]/12",
      )}
    >
      <span
        className={cn(
          "w-6 shrink-0 font-mono text-xs font-semibold",
          row.isYou
            ? "text-[#9c6f00] dark:text-[#FFD60A]"
            : DC.muted,
        )}
      >
        #{row.rank}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          row.isYou ? cn(DC.header, "font-semibold") : DC.normal,
        )}
      >
        {row.name}
      </span>
      <span className={cn("shrink-0 font-mono text-xs", DC.label)}>
        {leaderboardRowValue(row, metric)}
      </span>
    </div>
  );
}

function LeaderboardMessage(props: {
  data: LeaderboardPreviewResponse | undefined;
  metric: FlexMetric;
  loading: boolean;
  now: string;
}) {
  const { data, metric, loading, now } = props;
  const youRank = data?.you?.rank;
  const extraParts: string[] = [];
  if (data?.totalEntities != null) extraParts.push(`${data.totalEntities} ranked`);
  if (youRank) extraParts.push(`you're #${youRank}`);

  return (
    <>
      <LunaHeader now={now} />
      <EmbedShell>
        <div className={cn("text-sm font-semibold leading-snug", DC.header)}>
          🏆 {metricLabel(metric)} leaderboard
        </div>
        <div className="mt-1.5 space-y-0.5">
          {loading && !data ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                <span className={cn("w-6 shrink-0 font-mono text-xs", DC.muted)}>
                  #{i + 1}
                </span>
                <span
                  className={cn("h-3.5 flex-1 animate-pulse rounded", DC.skeleton)}
                />
                <span
                  className={cn("h-3.5 w-20 animate-pulse rounded", DC.skeleton)}
                />
              </div>
            ))
          ) : data && data.rows.length > 0 ? (
            data.rows.map((row) => (
              <LeaderboardRowItem key={row.rank} row={row} metric={metric} />
            ))
          ) : (
            <div className={cn("px-1.5 py-1 text-sm", DC.muted)}>
              No ranked users yet.
            </div>
          )}
        </div>
        <GlowFooter extra={extraParts.join(" · ") || undefined} />
      </EmbedShell>
    </>
  );
}

// ---- Tabbed preview panel ---------------------------------------------------

type PreviewTab = "flex" | "wallets" | "leaderboard";

const PREVIEW_TABS: { key: PreviewTab; label: string }[] = [
  { key: "flex", label: "!flex" },
  { key: "wallets", label: "!wallets" },
  { key: "leaderboard", label: "!leaderboard" },
];

const PREVIEW_CAPTIONS: Record<PreviewTab, React.ReactNode> = {
  flex: (
    <>
      Post your own stats any time with{" "}
      <span className="font-mono text-foreground">!flex</span>.
    </>
  ),
  wallets: (
    <>
      Flex anyone in the server with{" "}
      <span className="font-mono text-foreground">!wallets @user</span>.
    </>
  ),
  leaderboard: (
    <>
      See the top delegators with{" "}
      <span className="font-mono text-foreground">!leaderboard</span>.
    </>
  ),
};

const METRIC_TABS: { key: FlexMetric; label: string }[] = [
  { key: "vault", label: "Vault" },
  { key: "watts", label: "Power" },
  { key: "carbon", label: "Carbon" },
];

/**
 * The /connect success showcase: a segmented control over the three Discord
 * commands, each rendering a faithful mock of what Luna posts. Flex stats come
 * pre-fetched from the parent; the leaderboard lazy-loads on its tab and
 * re-ranks on the metric toggle.
 */
function PreviewPanel({
  name,
  wallet,
  flex,
  flexLoading,
}: {
  name: string | null;
  wallet: string;
  flex: FlexPreviewStats | undefined;
  flexLoading: boolean;
}) {
  const [tab, setTab] = React.useState<PreviewTab>("flex");
  const [metric, setMetric] = React.useState<FlexMetric>("vault");

  // Client-only timestamp avoids an SSR hydration mismatch.
  const [now, setNow] = React.useState<string>("");
  React.useEffect(() => {
    setNow(
      new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, []);

  const { data: lb, isLoading: lbLoading } = useLeaderboardPreview({
    wallet,
    metric,
    enabled: tab === "leaderboard",
  });

  return (
    <div className="space-y-3">
      {/* Command switcher */}
      <div className="flex gap-1 rounded-xl border border-border/20 bg-muted/20 p-1 dark:border-white/10">
        {PREVIEW_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 font-mono text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Metric toggle (leaderboard only) */}
      {tab === "leaderboard" ? (
        <div className="flex items-center justify-center gap-1.5">
          {METRIC_TABS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                metric === m.key
                  ? "bg-[color:var(--color-glow-yellow)]/80 text-[color:var(--color-glow-black)]"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Discord chat mock */}
      <div className={cn("rounded-xl p-3", DC.chat)}>
        {tab === "flex" ? (
          <FlexMessage name={name} stats={flex} loading={flexLoading} now={now} />
        ) : tab === "wallets" ? (
          <WalletsMessage name={name} stats={flex} loading={flexLoading} now={now} />
        ) : (
          <LeaderboardMessage
            data={lb}
            metric={metric}
            loading={lbLoading}
            now={now}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {PREVIEW_CAPTIONS[tab]}
      </p>
    </div>
  );
}

export function ConnectDiscordCard() {
  const { address, isConnecting, isReconnecting } = useAccount();

  // The Discord OAuth callback returns ?discord=linked&dl=<token>&u=<handle>.
  // The dl token is required by POST /discord/link and not stored server-side;
  // keep it in state (mirrored to sessionStorage across reloads).
  const [dlToken, setDlToken] = React.useState<string | null>(null);
  const [discordName, setDiscordName] = React.useState<string | null>(null);

  const processedRef = React.useRef(false);
  React.useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlDl = params.get("dl");
    const urlName = params.get("u");
    const discord = params.get("discord");

    const readStored = (key: string) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    };
    const writeStored = (key: string, value: string) => {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        // ignore (private mode, etc.)
      }
    };

    if (urlDl) {
      setDlToken(urlDl);
      writeStored(DL_STORAGE_KEY, urlDl);
    } else {
      const stored = readStored(DL_STORAGE_KEY);
      if (stored) setDlToken(stored);
    }

    if (urlName) {
      setDiscordName(urlName);
      writeStored(DISCORD_NAME_STORAGE_KEY, urlName);
    } else {
      const storedName = readStored(DISCORD_NAME_STORAGE_KEY);
      if (storedName) setDiscordName(storedName);
    }

    if (discord === "linked") toast.success("Discord connected — sign to confirm");
    else if (discord === "denied") toast.error("Discord connection cancelled");
    else if (discord === "conflict")
      toast.error("This wallet is already linked to a different Discord account");
    else if (discord === "error")
      toast.error("Discord connection failed, please try again");

    if (urlDl || urlName || discord) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const { status, isLoadingStatus, connectDiscord, bind, isBinding } =
    useDiscordLink({ discordLinkToken: dlToken });

  const hasWallet = Boolean(address);
  const verified = Boolean(status?.verified);
  const awaitingSignature = Boolean(dlToken) && !verified;
  const walletInitializing = isConnecting || isReconnecting;

  const { data: flex, isLoading: isFlexLoading } = useFlexPreview({
    wallet: address,
    enabled: verified,
  });

  const handleBind = React.useCallback(async () => {
    try {
      await bind();
    } catch {
      // errors surfaced via toast in the hook
    }
  }, [bind]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/20 bg-card shadow-sm dark:border-white/10">
      {/* Hero — Discord blurple, giant background mark, mono kicker. */}
      <div
        className="relative overflow-hidden px-8 pb-10 pt-8 text-white"
        style={{ backgroundColor: BLURPLE }}
      >
        <div className="pointer-events-none absolute -bottom-16 -right-10 opacity-[0.12]">
          <DiscordLogo className="h-64 w-64" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 opacity-80">
            <DiscordLogo className="h-5 w-5" />
            <span className="font-mono text-xs font-medium uppercase tracking-widest">
              Discord &times; Glow
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Link your Discord
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Connect your Discord to your Glow wallet, then{" "}
            <span className="font-mono text-white/90">!flex</span> your watts and
            actively&nbsp;delegated GLW in the server.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-5 p-8">
        {/* Connected wallet chip */}
        {hasWallet ? (
          <div className="flex items-center justify-between rounded-2xl border border-border/20 bg-muted/20 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-glow-green)]/15 text-[color:var(--color-glow-green)]">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="font-mono text-sm">{shortAddress(address!)}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Wallet connected
            </span>
          </div>
        ) : null}

        {/* Contextual action */}
        {!hasWallet ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/40 p-6 text-center dark:border-white/15">
            <p className="text-sm text-muted-foreground">
              Connect the wallet you want to flex.
            </p>
            <ConnectButton variant="default" />
            {walletInitializing ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Loader2 className="h-3 w-3 animate-spin" /> Reconnecting…
              </span>
            ) : null}
          </div>
        ) : isLoadingStatus && !verified ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/20 p-6 text-sm text-muted-foreground dark:border-white/10">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking link status…
          </div>
        ) : verified ? (
          <div className="space-y-4">
            {/* Linked confirmation */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-[color:var(--color-glow-green)]/30 bg-[color:var(--color-glow-green)]/10 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-glow-green)]/20 text-[color:var(--color-glow-green)]">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Discord linked</div>
                {discordName ? (
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {discordName}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Command previews — what each bot command posts in the server */}
            <div className="space-y-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Command previews
              </span>
              <PreviewPanel
                name={discordName}
                wallet={address!}
                flex={flex}
                flexLoading={isFlexLoading}
              />
            </div>
          </div>
        ) : awaitingSignature ? (
          <button
            type="button"
            onClick={handleBind}
            disabled={isBinding}
            className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/20 bg-muted/20 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 text-foreground">
                {isBinding ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PenLine className="h-5 w-5" />
                )}
              </span>
              <div>
                <div className="text-sm font-semibold">
                  {isBinding ? "Confirming…" : "Sign to confirm link"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {discordName ? (
                    <>
                      Free signature to bind{" "}
                      <span className="font-mono">{discordName}</span> to this
                      wallet.
                    </>
                  ) : (
                    "A free signature proves you own this wallet."
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={connectDiscord}
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: BLURPLE }}
          >
            <DiscordLogo className="h-5 w-5" />
            Connect Discord
            <ArrowRight className="h-4 w-4 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
