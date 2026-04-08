import { useQuery } from "@tanstack/react-query";
import type { ReferralDashboardKolPaybackResponse } from "./useReferralDashboard";

export type KolDashboardFilter =
  | { kind: "all_time" }
  | { kind: "month"; startWeek: number; endWeek: number; label: string };

type KolPaybackKol = ReferralDashboardKolPaybackResponse["kols"][number];

export interface KolDashboardResponse {
  range: ReferralDashboardKolPaybackResponse["range"];
  program: {
    paybackPercent: number;
    baseCommissionPercent: number;
    maxEcosystemBonusPercent: number;
    rollingDelegationWindowDays: number;
    ecosystemBonusFormula: string;
    startedAt: string;
    eligibilityRule: string;
  };
  kol: KolPaybackKol | null;
}

export interface KolAuth {
  walletAddress: string;
  signature?: string;
  message?: string;
  adminPassword?: string;
}

export function useKolDashboard(
  auth: KolAuth | null,
  filter: KolDashboardFilter
) {
  return useQuery<KolDashboardResponse>({
    queryKey: ["kol-dashboard", auth?.walletAddress, filter],
    queryFn: async () => {
      if (!auth) throw new Error("Not authenticated");

      const body: Record<string, string | number> = {
        walletAddress: auth.walletAddress,
      };

      if (auth.adminPassword) {
        body.adminPassword = auth.adminPassword;
      } else if (auth.signature && auth.message) {
        body.signature = auth.signature;
        body.message = auth.message;
      }

      if (filter.kind === "all_time") {
        body.rangePreset = "all_time";
      } else {
        body.startWeek = filter.startWeek;
        body.endWeek = filter.endWeek;
      }

      const res = await fetch("/api/kol/payback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Failed: ${res.status}`);
      }

      return res.json();
    },
    enabled: !!auth,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
