import { useQuery } from "@tanstack/react-query";
import type { ReferralDashboardKolPaybackResponse } from "./useReferralDashboard";

export type KolDashboardFilter =
  | { kind: "all_time" }
  | { kind: "month"; startWeek: number; endWeek: number; label: string };

type KolPaybackKol = ReferralDashboardKolPaybackResponse["kols"][number];

export interface KolDashboardResponse {
  range: ReferralDashboardKolPaybackResponse["range"];
  program: ReferralDashboardKolPaybackResponse["program"];
  summary: ReferralDashboardKolPaybackResponse["summary"];
  kol: KolPaybackKol | null;
}

interface KolAuth {
  walletAddress: string;
  signature: string;
  message: string;
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
        signature: auth.signature,
        message: auth.message,
      };

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
