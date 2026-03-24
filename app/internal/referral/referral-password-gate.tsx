"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralPasswordGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/referral-dashboard/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to unlock referral dashboard");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 lg:p-12">
      <div className="max-w-md">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
          Referral Access
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Password Protected
        </h1>
        <p className="mt-3 text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
          Enter the referral dashboard password to view internal KoL and referral
          reporting.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-muted/40 px-4 py-3 text-sm text-muted-foreground/70">
            <code>REFERRAL_DASHBOARD_PASSWORD</code> is not configured yet.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="h-11 rounded-2xl border-border/20 dark:border-border/40"
            />
            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}
            <Button
              type="submit"
              disabled={isPending || password.length === 0}
              className="h-11 rounded-2xl px-5"
            >
              {isPending ? "Unlocking..." : "Unlock Dashboard"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
