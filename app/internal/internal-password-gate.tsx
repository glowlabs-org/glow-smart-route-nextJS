"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InternalPasswordGate({ configured }: { configured: boolean }) {
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
      setError(payload?.error ?? "Unable to unlock internal tools");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-32">
        <div className="rounded-3xl border border-border/20 bg-card p-8 dark:border-border/40 lg:p-12">
          <div className="max-w-md">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
              Internal Access
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Password Protected
            </h1>
            <p className="mt-3 text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
              Enter the internal dashboard password to view Glow internal
              tooling.
            </p>

            {!configured ? (
              <div className="mt-6 rounded-2xl border border-border/20 bg-muted/20 px-4 py-3 text-sm text-muted-foreground/70 dark:border-border/40 dark:bg-muted/40">
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
                  {isPending ? "Unlocking..." : "Unlock Internal"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
