"use client";

import * as React from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { useAdminPointsGrant } from "@/hooks/use-admin-points-grant";

const MAX_RECIPIENTS = 10;

interface ParsedRow {
  wallet: string;
  /** The raw amount string, for display. */
  points: string;
  /** scaled6 micros (the exact value that gets signed and sent). */
  micros: bigint;
}

interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
  totalMicros: bigint;
}

/**
 * Parse the recipients textarea. One recipient per line:
 *   0xWallet, 500
 *   0xWallet 12.5
 * (comma or whitespace separated). Blank lines are ignored.
 *
 * Amounts are parsed with the SAME `parseUnits(.., 6)` the signing hook and
 * backend use, so a line that would later fail the signed conversion is
 * flagged here (before the submit button goes green) rather than throwing a
 * raw viem error after the click.
 */
function parseRecipients(raw: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  let totalMicros = 0n;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: expected "wallet, amount"`);
      continue;
    }
    const [wallet, amount] = parts;
    if (!isAddress(wallet)) {
      errors.push(`Line ${i + 1}: invalid wallet address`);
      continue;
    }
    let micros: bigint;
    try {
      micros = parseUnits(amount, 6);
    } catch {
      errors.push(`Line ${i + 1}: amount must be a plain number (e.g. 500 or 12.5)`);
      continue;
    }
    if (micros <= 0n) {
      errors.push(`Line ${i + 1}: amount must be greater than 0 (min 0.000001)`);
      continue;
    }
    rows.push({ wallet, points: amount, micros });
    totalMicros += micros;
  }

  if (rows.length > MAX_RECIPIENTS) {
    errors.push(`Too many recipients (${rows.length}); max is ${MAX_RECIPIENTS}`);
  }

  const seen = new Set<string>();
  for (const r of rows) {
    const key = r.wallet.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Duplicate wallet ${r.wallet}; combine into one line`);
    }
    seen.add(key);
  }

  return { rows, errors, totalMicros };
}

function shortWallet(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export function PointsGrantDashboard() {
  const { signerAddress, isConnected, grant, isGranting, lastResult, reset } =
    useAdminPointsGrant();
  const [recipientsRaw, setRecipientsRaw] = React.useState("");
  const [reason, setReason] = React.useState("");

  const parsed = React.useMemo(
    () => parseRecipients(recipientsRaw),
    [recipientsRaw],
  );

  // A stable per-batch idempotency key: regenerated whenever the draft changes,
  // so an unchanged retry after a lost/ambiguous response reuses the same key
  // (the backend dedupes it to a no-op) while any edit or new batch gets a
  // fresh key. Generated in an effect so it never runs during SSR.
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>("");
  React.useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [recipientsRaw, reason]);

  const canSubmit =
    isConnected &&
    parsed.rows.length > 0 &&
    parsed.errors.length === 0 &&
    reason.trim().length > 0 &&
    !isGranting;

  async function handleGrant() {
    try {
      reset();
      const result = await grant({
        recipients: parsed.rows.map((r) => ({
          wallet: r.wallet,
          amountMicros: r.micros,
        })),
        reason: reason.trim(),
        idempotencyKey: idempotencyKey || undefined,
      });
      const fresh = result.grants.filter((g) => !g.alreadyProcessed).length;
      const dupes = result.grants.length - fresh;
      toast.success(
        `Granted ${fresh} recipient${fresh === 1 ? "" : "s"}` +
          (dupes > 0 ? ` (${dupes} already applied)` : ""),
      );
      setRecipientsRaw("");
      setReason("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/user rejected|user denied|rejected the request/i.test(message)) {
        toast.error("Signature rejected");
      } else {
        toast.error(message || "Grant failed");
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
          Internal
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
          Points Grants
        </h1>
        <p className="mt-2 text-sm text-muted-foreground/70">
          Assign points to wallets for Discord activities and manual bonuses.
          Each grant is signed by your wallet, recorded to the ledger as an
          audit-safe <code>admin_grant</code>, and announced to dev Discord.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signer</CardTitle>
          <CardDescription>
            Your wallet must be on the operator allowlist for the grant to be
            accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono">{signerAddress}</span>
            </div>
          ) : (
            <ConnectButton variant="default" size="medium" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
          <CardDescription>
            One per line: <code>wallet, amount</code> (comma or space). Max{" "}
            {MAX_RECIPIENTS} per grant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={recipientsRaw}
            onChange={(e) => setRecipientsRaw(e.target.value)}
            placeholder={"0x1234…abcd, 500\n0x5678…ef01, 250"}
            rows={6}
            className="font-mono text-sm"
          />

          {parsed.errors.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive">
              {parsed.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}

          {parsed.rows.length > 0 ? (
            <div className="rounded-xl border border-border/30 divide-y divide-border/20 text-sm">
              {parsed.rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-mono">{shortWallet(r.wallet)}</span>
                  <span className="tabular-nums">{r.points} pts</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 font-medium">
                <span>{parsed.rows.length} recipients</span>
                <span className="tabular-nums">
                  {formatUnits(parsed.totalMicros, 6)} pts total
                </span>
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-sm text-muted-foreground/80">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Discord trivia night #4"
              maxLength={500}
              className="mt-1.5"
            />
          </div>

          <Button
            onClick={handleGrant}
            disabled={!canSubmit}
            className="h-11 rounded-2xl"
          >
            {isGranting
              ? "Sign in your wallet…"
              : `Sign & grant${parsed.rows.length > 0 ? ` (${parsed.rows.length})` : ""}`}
          </Button>
          {!isConnected ? (
            <p className="text-xs text-muted-foreground/60">
              Connect your allowlisted wallet to sign.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last grant</CardTitle>
            <CardDescription>
              Week {lastResult.protocolWeek} · key{" "}
              <span className="font-mono">
                {lastResult.idempotencyKey.slice(0, 8)}…
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/30 divide-y divide-border/20 text-sm">
              {lastResult.grants.map((g) => (
                <div
                  key={g.ledgerId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="font-mono">{shortWallet(g.wallet)}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">+{g.pointsDelta}</span>
                    {g.alreadyProcessed ? (
                      <span className="text-xs text-muted-foreground/60">
                        already applied
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600">
                        bal {g.balanceAfter}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
