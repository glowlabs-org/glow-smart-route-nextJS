"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  PenLine,
} from "lucide-react";

import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDiscordLink } from "@/hooks/use-discord-link";
import { shortAddress } from "@/utils/impact";

const DL_STORAGE_KEY = "glow_connect_dl";
const DISCORD_NAME_STORAGE_KEY = "glow_connect_discord_name";

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
      toast.error("That Discord account is already linked to another wallet");
    else if (discord === "error")
      toast.error("Discord connection failed, please try again");

    if (urlDl || urlName || discord) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const {
    status,
    isLoadingStatus,
    connectDiscord,
    bind,
    isBinding,
  } = useDiscordLink({ discordLinkToken: dlToken });

  const walletInitializing = isConnecting || isReconnecting;
  const verified = Boolean(status?.verified);
  // A fresh OAuth token is present and we still need the wallet signature.
  const awaitingSignature = Boolean(dlToken) && !verified;

  const handleBind = React.useCallback(async () => {
    try {
      await bind();
    } catch {
      // errors surfaced via toast in the hook
    }
  }, [bind]);

  return (
    <div className="rounded-3xl border border-border/20 bg-card p-8 dark:border-white/10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#5865F2]">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Link your Discord
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Connect your Discord account to your Glow wallet so you can{" "}
          <span className="font-mono">!flex</span> your watts and actively
          delegated GLW in the server.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {/* Step 1 — wallet */}
        {!address ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/20 p-6 dark:border-white/10">
            <p className="text-sm text-muted-foreground">
              Connect the wallet you want to flex.
            </p>
            <ConnectButton variant="default" />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-border/20 p-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--color-glow-green)]" />
              <span className="font-mono text-sm">{shortAddress(address)}</span>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase">
              Wallet connected
            </Badge>
          </div>
        )}

        {/* Step 2 — link / sign / done */}
        {address ? (
          isLoadingStatus && !verified ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/20 p-6 text-sm text-muted-foreground dark:border-white/10">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking link status…
            </div>
          ) : verified ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[color:var(--color-glow-green)]/30 bg-[color:var(--color-glow-green)]/10 p-6 text-center">
              <ShieldCheck className="h-8 w-8 text-[color:var(--color-glow-green)]" />
              <div className="font-semibold">Discord linked</div>
              {discordName ? (
                <div className="font-mono text-sm text-muted-foreground">
                  {discordName}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                You&apos;re all set. Head to Discord and run{" "}
                <span className="font-mono">!flex</span>.
              </p>
            </div>
          ) : awaitingSignature ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/20 p-6 text-center dark:border-white/10">
              <PenLine className="h-7 w-7 text-foreground" />
              <div className="space-y-1">
                <div className="font-semibold">One last step</div>
                <p className="text-sm text-muted-foreground">
                  {discordName ? (
                    <>
                      Sign a free message to prove you own this wallet and bind
                      it to <span className="font-mono">{discordName}</span>.
                    </>
                  ) : (
                    "Sign a free message to prove you own this wallet and bind it to your Discord."
                  )}
                </p>
              </div>
              <Button onClick={handleBind} disabled={isBinding} className="w-full">
                {isBinding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…
                  </>
                ) : (
                  "Sign to confirm link"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/20 p-6 text-center dark:border-white/10">
              <p className="text-sm text-muted-foreground">
                Authorize Discord (we only read your ID), then sign once to bind
                it to your wallet.
              </p>
              <Button
                onClick={connectDiscord}
                className="w-full bg-[#5865F2] text-white hover:bg-[#4752c4]"
              >
                <MessageSquare className="mr-2 h-4 w-4" /> Connect Discord
              </Button>
            </div>
          )
        ) : null}

        {!address && walletInitializing ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Reconnecting wallet…
          </div>
        ) : null}
      </div>
    </div>
  );
}
