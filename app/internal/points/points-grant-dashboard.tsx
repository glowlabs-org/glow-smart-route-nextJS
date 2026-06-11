"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress, parseUnits } from "viem";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { v2ApiGet } from "@/lib/api/v2-api-client";
import type { V2PointsBalance } from "@/hooks/v2-points";
import {
  GrantApiError,
  useAdminPointsGrant,
  type GrantResponse,
} from "@/hooks/use-admin-points-grant";

const MAX_RECIPIENTS = 10;

/** Backend error codes mapped to actionable, human messages. */
const FRIENDLY_GRANT_ERRORS: Record<string, string> = {
  SIGNER_NOT_ALLOWLISTED:
    "This wallet isn't on the operator allowlist. Switch to an operator wallet and try again.",
  INVALID_SIGNATURE:
    "The signature didn't verify on the server. Sign again without editing the batch in between.",
  DEADLINE_EXPIRED:
    "The signature window (10 min) expired before the grant landed. Sign again.",
  INVALID_API_KEY:
    "The dashboard server can't authenticate to the backend (GUARDED_API_KEY). Ping whoever runs the deploy.",
  INVALID_BATCH:
    "The server rejected the batch shape. Check the amounts and recipients, then retry.",
  INVALID_BODY:
    "The server rejected the request as malformed. Refresh the page and try again.",
};

/** One editable recipient row. `id` is a stable React key, never sent. */
interface RecipientRowInput {
  id: string;
  wallet: string;
  amount: string;
}

interface ParsedRow {
  wallet: string;
  /** The raw amount string, for display. */
  points: string;
  /** scaled6 micros (the exact value that gets signed and sent). */
  micros: bigint;
}

interface RowEvaluation {
  /** Fully valid rows, in form order — exactly what gets signed. */
  parsedRows: ParsedRow[];
  /** Per-row error message, keyed by row id. Empty rows are not errors. */
  rowErrors: Record<string, string>;
  totalMicros: bigint;
  /** Rows with at least one non-empty field (empty rows are ignored). */
  filledCount: number;
}

/**
 * Validate the form rows. Amounts are parsed with the SAME
 * `parseUnits(.., 6)` the signing hook and backend use, so a row that would
 * later fail the signed conversion is flagged here (before the submit button
 * goes green) rather than throwing a raw viem error after the click.
 * Completely empty rows are neutral: ignored, never blocking.
 */
function evaluateRows(rows: RecipientRowInput[]): RowEvaluation {
  const parsedRows: ParsedRow[] = [];
  const rowErrors: Record<string, string> = {};
  let totalMicros = 0n;
  let filledCount = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const wallet = row.wallet.trim();
    const amount = row.amount.trim();
    if (wallet === "" && amount === "") continue;
    filledCount++;

    if (wallet === "") {
      rowErrors[row.id] = "Add a wallet address";
      continue;
    }
    if (!isAddress(wallet)) {
      rowErrors[row.id] = "Invalid wallet address";
      continue;
    }
    const key = wallet.toLowerCase();
    if (seen.has(key)) {
      rowErrors[row.id] = "Duplicate wallet — combine into one row";
      continue;
    }
    if (amount === "") {
      seen.add(key);
      rowErrors[row.id] = "Add an amount";
      continue;
    }
    let micros: bigint;
    try {
      micros = parseUnits(amount, 6);
    } catch {
      seen.add(key);
      rowErrors[row.id] = "Amount must be a plain number (e.g. 500 or 12.5)";
      continue;
    }
    if (micros <= 0n) {
      seen.add(key);
      rowErrors[row.id] = "Amount must be greater than 0 (min 0.000001)";
      continue;
    }

    seen.add(key);
    parsedRows.push({ wallet, points: amount, micros });
    totalMicros += micros;
  }

  return { parsedRows, rowErrors, totalMicros, filledCount };
}

/**
 * Multi-entry clipboard text ("wallet, amount" per line — what a sheet or
 * the old textarea produces). Returns null for a plain single address so the
 * normal paste-into-the-input behavior is kept.
 */
function parseBulkPaste(
  text: string,
): Array<{ wallet: string; amount: string }> | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.length === 1 && !/[\s,;\t]/.test(lines[0])) return null;
  return lines.map((line) => {
    const parts = line.split(/[,;\t\s]+/).filter(Boolean);
    return { wallet: parts[0] ?? "", amount: parts[1] ?? "" };
  });
}

function shortWallet(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function formatPts(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function copyText(value: string, label = "value") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

/**
 * Current points balance per valid wallet, so the operator sees
 * "0 → 500" before signing and a typo'd-but-valid address (almost always
 * balance 0 and never seen before) stands out. Debounced so typing doesn't
 * spam the API; max 10 wallets by construction.
 */
function useRecipientBalances(wallets: string[]): {
  balances: Record<string, number | null>;
} {
  const key = React.useMemo(
    () => [...new Set(wallets.map((w) => w.toLowerCase()))].sort().join(","),
    [wallets],
  );
  const [debouncedKey, setDebouncedKey] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(key), 400);
    return () => clearTimeout(t);
  }, [key]);

  const query = useQuery({
    queryKey: ["admin-points-grant", "recipient-balances", debouncedKey],
    enabled: debouncedKey.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: Record<string, number | null> | undefined) => prev,
    queryFn: async () => {
      const entries = await Promise.all(
        debouncedKey.split(",").map(async (w) => {
          try {
            const b = await v2ApiGet<V2PointsBalance>(
              `/api/points/balance?wallet=${encodeURIComponent(w)}`,
            );
            return [w, b.availablePoints] as const;
          } catch {
            return [w, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, number | null>;
    },
  });

  return { balances: query.data ?? {} };
}

function CopyIconButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copyText(value, label)}
      title={`Copy ${label}`}
      className="inline-flex shrink-0 items-center text-muted-foreground/40 transition-colors hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

/** A grant response plus what the form knew about it, for the session log. */
interface SessionGrant extends GrantResponse {
  reason: string;
}

const emptyRow = (id: string): RecipientRowInput => ({
  id,
  wallet: "",
  amount: "",
});

export function PointsGrantDashboard() {
  const { signerAddress, isConnected, grant, isGranting, phase, reset } =
    useAdminPointsGrant();
  // Deterministic first id keeps SSR + hydration in sync; the counter only
  // advances from client-side interactions.
  const rowIdCounter = React.useRef(1);
  const nextRowId = () => `row-${rowIdCounter.current++}`;
  const [rows, setRows] = React.useState<RecipientRowInput[]>([
    emptyRow("row-0"),
  ]);
  const [reason, setReason] = React.useState("");
  const [history, setHistory] = React.useState<SessionGrant[]>([]);
  const lastAddedRowId = React.useRef<string | null>(null);

  const evaluation = React.useMemo(() => evaluateRows(rows), [rows]);
  const rowErrorCount = Object.keys(evaluation.rowErrors).length;
  const { balances } = useRecipientBalances(
    evaluation.parsedRows.map((r) => r.wallet),
  );

  // A stable per-batch idempotency key: regenerated whenever the draft changes,
  // so an unchanged retry after a lost/ambiguous response reuses the same key
  // (the backend dedupes it to a no-op) while any edit or new batch gets a
  // fresh key. Generated in an effect so it never runs during SSR.
  const draftFingerprint = React.useMemo(
    () => JSON.stringify([rows.map((r) => [r.wallet, r.amount]), reason]),
    [rows, reason],
  );
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>("");
  React.useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [draftFingerprint]);

  function updateRow(id: string, patch: Partial<RecipientRowInput>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    const id = nextRowId();
    lastAddedRowId.current = id;
    setRows((prev) =>
      prev.length >= MAX_RECIPIENTS ? prev : [...prev, emptyRow(id)],
    );
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [emptyRow(nextRowId())];
    });
  }

  function resetForm() {
    setRows([emptyRow(nextRowId())]);
    setReason("");
  }

  /** Bulk paste (sheet / CSV) into a wallet field: explode into rows. */
  function handleWalletPaste(
    rowId: string,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const entries = parseBulkPaste(e.clipboardData.getData("text"));
    if (!entries) return; // plain single address → default input behavior
    e.preventDefault();
    setRows((prev) => {
      const at = prev.findIndex((r) => r.id === rowId);
      const before = prev.slice(0, at);
      const target = prev[at];
      const after = prev.slice(at + 1);
      const pasted: RecipientRowInput[] = entries.map((entry, i) => ({
        id: i === 0 ? target.id : nextRowId(),
        wallet: entry.wallet,
        // Pasting only addresses over a row that already has an amount keeps it.
        amount: entry.amount || (i === 0 ? target.amount : ""),
      }));
      const merged = [
        ...before,
        ...pasted,
        ...after.filter((r) => r.wallet.trim() !== "" || r.amount.trim() !== ""),
      ];
      if (merged.length > MAX_RECIPIENTS) {
        toast.warning(
          `Only the first ${MAX_RECIPIENTS} recipients were kept (max per grant).`,
        );
      }
      return merged.slice(0, MAX_RECIPIENTS);
    });
  }

  const canSubmit =
    isConnected &&
    evaluation.parsedRows.length > 0 &&
    rowErrorCount === 0 &&
    reason.trim().length > 0 &&
    !isGranting;

  // The single reason the button is disabled right now, so the operator never
  // has to guess. Checked in the order the operator fixes things.
  const submitHint = React.useMemo(() => {
    if (isGranting || canSubmit) return null;
    if (!isConnected) return "Connect your allowlisted wallet to sign.";
    if (evaluation.filledCount === 0) {
      return "Add at least one recipient to get started.";
    }
    if (rowErrorCount > 0) {
      return `Fix the ${rowErrorCount === 1 ? "highlighted row" : `${rowErrorCount} highlighted rows`} to continue.`;
    }
    if (reason.trim().length === 0) {
      return "Add a short reason — it's recorded on the ledger and in the Discord alert.";
    }
    return null;
  }, [isGranting, canSubmit, isConnected, evaluation, rowErrorCount, reason]);

  const buttonLabel = React.useMemo(() => {
    if (phase === "switching-chain") return "Switching network…";
    if (phase === "signing") return "Sign in your wallet…";
    if (phase === "submitting") return "Granting…";
    return `Sign & grant${evaluation.parsedRows.length > 0 ? ` (${evaluation.parsedRows.length})` : ""}`;
  }, [phase, evaluation.parsedRows.length]);

  const formIsEmpty = evaluation.filledCount === 0 && reason.trim() === "";

  async function handleGrant() {
    const reasonTrimmed = reason.trim();
    try {
      reset();
      const result = await grant({
        recipients: evaluation.parsedRows.map((r) => ({
          wallet: r.wallet,
          amountMicros: r.micros,
        })),
        reason: reasonTrimmed,
        idempotencyKey: idempotencyKey || undefined,
      });
      const fresh = result.grants.filter((g) => !g.alreadyProcessed).length;
      const dupes = result.grants.length - fresh;
      toast.success(
        `Granted ${fresh} recipient${fresh === 1 ? "" : "s"}` +
          (dupes > 0 ? ` (${dupes} already applied)` : ""),
      );
      setHistory((prev) =>
        [{ ...result, reason: reasonTrimmed }, ...prev].slice(0, 8),
      );
      resetForm();
    } catch (err) {
      if (err instanceof GrantApiError && err.code) {
        toast.error(FRIENDLY_GRANT_ERRORS[err.code] ?? err.message);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (/user rejected|user denied|rejected the request/i.test(message)) {
        toast.error("Signature rejected in the wallet");
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
          {isConnected && signerAddress ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono break-all">{signerAddress}</span>
              <CopyIconButton value={signerAddress} label="signer address" />
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
            Up to {MAX_RECIPIENTS} per grant. Tip: paste a whole list from a
            sheet into any wallet field and the rows fill themselves.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground/60">
              <span className="flex-1">Wallet</span>
              <span className="w-28 sm:w-32">Points</span>
              <span className="w-8" />
            </div>

            {rows.map((row) => {
              const error = evaluation.rowErrors[row.id];
              const walletValid = isAddress(row.wallet.trim());
              const current = walletValid
                ? balances[row.wallet.trim().toLowerCase()]
                : null;
              const amountNum = Number(row.amount);
              const showBalance =
                current != null && !error && row.amount.trim() !== "";
              return (
                <div key={row.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={row.wallet}
                      onChange={(e) =>
                        updateRow(row.id, { wallet: e.target.value })
                      }
                      onPaste={(e) => handleWalletPaste(row.id, e)}
                      placeholder="0x…"
                      disabled={isGranting}
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus={row.id === lastAddedRowId.current}
                      aria-invalid={Boolean(error)}
                      aria-label="Recipient wallet"
                      className={`flex-1 font-mono text-sm ${error ? "border-destructive/60 focus-visible:ring-destructive/30" : ""}`}
                    />
                    <Input
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(row.id, { amount: e.target.value })
                      }
                      placeholder="500"
                      disabled={isGranting}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label="Points amount"
                      className="w-28 text-right tabular-nums sm:w-32"
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          rows.length < MAX_RECIPIENTS &&
                          row.id === rows[rows.length - 1].id
                        ) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={isGranting}
                      title="Remove row"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-accent/10 hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {error || showBalance ? (
                    <div className="flex items-center justify-between gap-2 px-1 text-xs">
                      <span className="text-destructive">{error ?? ""}</span>
                      {showBalance ? (
                        <span
                          className="tabular-nums text-muted-foreground/60"
                          title="Current balance → balance after this grant"
                        >
                          bal {formatPts(current)} →{" "}
                          {formatPts(current + (Number.isFinite(amountNum) ? amountNum : 0))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={addRow}
                disabled={isGranting || rows.length >= MAX_RECIPIENTS}
                className="h-9 rounded-xl px-3"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add recipient
                {rows.length >= MAX_RECIPIENTS ? ` (max ${MAX_RECIPIENTS})` : ""}
              </Button>
              {evaluation.parsedRows.length > 0 ? (
                <span className="text-sm font-medium tabular-nums">
                  {evaluation.parsedRows.length} recipient
                  {evaluation.parsedRows.length === 1 ? "" : "s"} ·{" "}
                  {formatUnits(evaluation.totalMicros, 6)} pts total
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground/80">
              Reason{" "}
              <span className="text-xs text-muted-foreground/50">
                · recorded on the ledger and in the Discord alert
              </span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Discord trivia night #4"
              maxLength={500}
              disabled={isGranting}
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleGrant}
              disabled={!canSubmit}
              className="h-11 flex-1 rounded-2xl"
            >
              {buttonLabel}
            </Button>
            {!formIsEmpty && !isGranting ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-11 rounded-2xl px-4"
                onClick={resetForm}
              >
                Clear
              </Button>
            ) : null}
          </div>
          {submitHint ? (
            <p className="text-xs text-muted-foreground/60">{submitHint}</p>
          ) : null}
        </CardContent>
      </Card>

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent grants</CardTitle>
            <CardDescription>
              This session only — the durable record is the points ledger and
              the dev-Discord alert.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history.map((h) => {
              const total = h.grants.reduce(
                (sum, g) => sum + Number(g.pointsDelta),
                0,
              );
              const time = new Date(h.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={h.idempotencyKey}
                  className="rounded-xl border border-border/30 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 px-3 py-2">
                    <span className="font-medium tabular-nums">
                      +{formatPts(total)} pts
                      <span className="ml-2 font-normal text-muted-foreground/60">
                        · {h.grants.length} recipient
                        {h.grants.length === 1 ? "" : "s"} · week{" "}
                        {h.protocolWeek}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                      <span>{time}</span>
                      <span className="font-mono">
                        {h.idempotencyKey.slice(0, 8)}…
                      </span>
                      <CopyIconButton
                        value={h.idempotencyKey}
                        label="idempotency key"
                      />
                    </span>
                  </div>
                  {h.reason ? (
                    <div className="border-b border-border/20 px-3 py-1.5 text-xs text-muted-foreground/70">
                      {h.reason}
                    </div>
                  ) : null}
                  <div className="divide-y divide-border/20">
                    {h.grants.map((g) => (
                      <div
                        key={g.ledgerId}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-mono" title={g.wallet}>
                            {shortWallet(g.wallet)}
                          </span>
                          <CopyIconButton value={g.wallet} label="wallet" />
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="tabular-nums">+{g.pointsDelta}</span>
                          {g.alreadyProcessed ? (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                              already applied
                            </span>
                          ) : (
                            <span className="text-xs tabular-nums text-emerald-600">
                              bal {g.balanceAfter}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
