"use client";

import React from "react";
import { useAccount } from "wagmi";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { isKolWallet } from "@/lib/kol";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { KOL_WALLETS } from "@/lib/kol";
import {
  useKolDashboard,
  type KolAuth,
  type KolDashboardFilter,
  type KolDashboardResponse,
} from "@/hooks/useKolDashboard";

// ---- Formatting helpers (shared with internal dashboard) ----

function formatWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function CopyableWallet({
  wallet,
  className,
}: {
  wallet: string;
  className?: string;
}) {
  const { t } = useLang();
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    toast.success(t.walletCopied);
    setTimeout(() => setCopied(false), 2000);
  }, [wallet, t.walletCopied]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 font-mono hover:text-foreground transition-colors ${className ?? ""}`}
    >
      {formatWallet(wallet)}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-40 hover:opacity-70" />
      )}
    </button>
  );
}

function addCommas(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatUsdFromRawUsdc6(value: string | bigint) {
  const raw = typeof value === "bigint" ? value : BigInt(value);
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;
  const cents = (abs + 5_000n) / 10_000n;
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `$${isNegative ? "-" : ""}${addCommas(whole.toString())}.${fraction}`;
}

function formatGlwAmount(
  value: string | bigint,
  options?: { raw?: boolean; maximumFractionDigits?: number }
) {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  let normalized = "";
  if (options?.raw) {
    try {
      const raw = typeof value === "bigint" ? value : BigInt(value);
      normalized = formatUnits(raw, 18);
    } catch {
      normalized = String(value);
    }
  } else {
    normalized = typeof value === "bigint" ? value.toString() : value;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num)) return `${value} GLW`;
  return `${num.toLocaleString("en-US", { maximumFractionDigits })} GLW`;
}

function formatPercentValue(value: string | number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return `${value}%`;
  return `${num.toFixed(num >= 10 ? 2 : 3)}%`;
}

function formatDate(isoString: string, lang: Lang = "en") {
  return new Date(isoString).toLocaleDateString(
    lang === "ko" ? "ko-KR" : "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );
}

function formatLongDate(isoString: string, lang: Lang = "en") {
  return new Date(isoString).toLocaleDateString(
    lang === "ko" ? "ko-KR" : "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatDateTime(isoString: string, lang: Lang = "en") {
  return new Date(isoString).toLocaleString(
    lang === "ko" ? "ko-KR" : "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

// ---- Localization (English / Korean) ----

type Lang = "en" | "ko";
const LANG_STORAGE_KEY = "ambassador-dashboard-lang";

interface Strings {
  pageTitle: string;
  subtitlePrefix: string;
  allTime: string;

  connectPrompt: string;
  accessDeniedTitle: string;
  accessDeniedPrefix: string;
  accessDeniedSuffix: string;
  signPromptPrefix: string;
  signPromptSuffix: string;
  verifyButton: string;
  signing: string;

  sales: string;
  volume: string;
  payback: string;
  rolling30dDelegated: string;
  paybackRate: string;

  delegators: (n: number) => string;
  saleAttributionHint: (direct: number, second: number) => string;
  weekRangeHint: (start: number, end: number) => string;
  baseCommissionHint: (pct: number) => string;
  delegationBonus: (pct: string) => string;
  uncertaintyBonus: (pct: string) => string;

  networkBonus: string;
  networkBonusHeadline: (pct: number) => string;
  networkBonusDescription: (date: string, weekNumber: number) => string;
  yourBase: string;
  bonus: string;
  total: string;

  minerSales: string;
  minerSalesLegend: string;
  delegated30D: string;
  delegated30DLegend: string;

  weeklyBreakdown: string;
  weekColumn: string;
  salesColumn: string;
  volumeColumn: string;
  paybackColumn: string;
  delegated30DColumn: string;
  weekLabel: (n: number) => string;
  inProgress: string;
  salesCount: (n: number) => string;
  inclBonus: (amount: string) => string;

  typeHeader: string;
  buyerHeader: string;
  farmHeader: string;
  amountHeader: string;
  paybackHeader: string;
  dateHeader: string;
  stepsCount: (n: number) => string;
  direct: string;
  secondDeg: string;

  refreshing: string;
  unableToLoad: string;
  retry: string;
  noData: string;

  walletCopied: string;
  signFailed: string;

  switchLanguageAria: string;
}

const TRANSLATIONS: Record<Lang, Strings> = {
  en: {
    pageTitle: "Ambassador Dashboard",
    subtitlePrefix: "Commission tracking for",
    allTime: "All Time",

    connectPrompt: "Connect your ambassador wallet to see your dashboard.",
    accessDeniedTitle: "Access Denied",
    accessDeniedPrefix: "The connected wallet ",
    accessDeniedSuffix:
      " is not registered as an ambassador. Please connect with your approved wallet.",
    signPromptPrefix: "Sign a message to verify ownership of ",
    signPromptSuffix: " and access your dashboard.",
    verifyButton: "Verify Identity",
    signing: "Signing...",

    sales: "Sales",
    volume: "Volume",
    payback: "Payback",
    rolling30dDelegated: "Rolling 30D Delegated",
    paybackRate: "Payback Rate",

    delegators: (n) => `${n} delegators`,
    saleAttributionHint: (direct, second) =>
      `${direct} direct, ${second} 2nd-degree`,
    weekRangeHint: (start, end) => `Week ${start} - ${end}`,
    baseCommissionHint: (pct) => `${pct}% base commission`,
    delegationBonus: (pct) => `+${pct} delegation bonus`,
    uncertaintyBonus: (pct) => `+${pct} uncertainty bonus`,

    networkBonus: "Network Bonus",
    networkBonusHeadline: (pct) =>
      `+${pct}% of every ambassador you recruited`,
    networkBonusDescription: (date, weekNumber) =>
      `Active since ${date} (week ${weekNumber}). Paid on top of your own commission — the ambassadors you recruited still receive their full payback.`,
    yourBase: "Your payback",
    bonus: "Bonus",
    total: "Total",

    minerSales: "Miner Sales",
    minerSalesLegend: "Miner Sales ($)",
    delegated30D: "30D Delegated (USD)",
    delegated30DLegend: "30D Delegated ($, GLW + sGCTL)",

    weeklyBreakdown: "Weekly Breakdown",
    weekColumn: "Week",
    salesColumn: "Sales",
    volumeColumn: "Volume",
    paybackColumn: "Payback",
    delegated30DColumn: "30D Delegated ($)",
    weekLabel: (n) => `Week ${n}`,
    inProgress: "In progress",
    salesCount: (n) => `${n} ${n === 1 ? "sale" : "sales"}`,
    inclBonus: (amount) => `incl ${amount} bonus`,

    typeHeader: "Type",
    buyerHeader: "Buyer",
    farmHeader: "Farm",
    amountHeader: "Amount",
    paybackHeader: "Payback",
    dateHeader: "Date",
    stepsCount: (n) => `${n} steps`,
    direct: "direct",
    secondDeg: "2nd deg",

    refreshing: "Refreshing...",
    unableToLoad: "Unable to load dashboard data.",
    retry: "Retry",
    noData: "No data found for your wallet in this period.",

    walletCopied: "Wallet address copied",
    signFailed: "Signing failed. Please try again.",

    switchLanguageAria: "Switch to Korean",
  },
  ko: {
    pageTitle: "앰배서더 대시보드",
    subtitlePrefix: "커미션 추적:",
    allTime: "전체 기간",

    connectPrompt: "대시보드를 보려면 앰배서더 지갑을 연결해 주세요.",
    accessDeniedTitle: "접근 거부됨",
    accessDeniedPrefix: "연결된 지갑 ",
    accessDeniedSuffix:
      "은(는) 앰배서더로 등록되지 않았습니다. 승인된 지갑으로 연결해 주세요.",
    signPromptPrefix: "지갑 ",
    signPromptSuffix:
      "의 소유권을 확인하고 대시보드에 접속하려면 메시지에 서명해 주세요.",
    verifyButton: "본인 인증",
    signing: "서명 중...",

    sales: "판매",
    volume: "거래량",
    payback: "페이백",
    rolling30dDelegated: "30일 누적 위임",
    paybackRate: "페이백 비율",

    delegators: (n) => `위임자 ${n}명`,
    saleAttributionHint: (direct, second) =>
      `직접 ${direct}건, 2단계 ${second}건`,
    weekRangeHint: (start, end) => `${start}주 - ${end}주`,
    baseCommissionHint: (pct) => `기본 커미션 ${pct}%`,
    delegationBonus: (pct) => `위임 보너스 +${pct}`,
    uncertaintyBonus: (pct) => `불확실성 보너스 +${pct}`,

    networkBonus: "네트워크 보너스",
    networkBonusHeadline: (pct) =>
      `추천하신 모든 앰배서더 페이백의 +${pct}%`,
    networkBonusDescription: (date, weekNumber) =>
      `${date}(${weekNumber}주)부터 적용됩니다. 본인의 커미션에 추가로 지급되며, 추천하신 앰배서더들도 전액 페이백을 받습니다.`,
    yourBase: "본인 페이백",
    bonus: "보너스",
    total: "총액",

    minerSales: "마이너 판매",
    minerSalesLegend: "마이너 판매 ($)",
    delegated30D: "30일 위임 (USD)",
    delegated30DLegend: "30일 위임 ($, GLW + sGCTL)",

    weeklyBreakdown: "주간 상세",
    weekColumn: "주차",
    salesColumn: "판매",
    volumeColumn: "거래량",
    paybackColumn: "페이백",
    delegated30DColumn: "30일 위임 ($)",
    weekLabel: (n) => `${n}주`,
    inProgress: "진행 중",
    salesCount: (n) => `${n}건`,
    inclBonus: (amount) => `보너스 ${amount} 포함`,

    typeHeader: "유형",
    buyerHeader: "구매자",
    farmHeader: "팜",
    amountHeader: "금액",
    paybackHeader: "페이백",
    dateHeader: "날짜",
    stepsCount: (n) => `${n} 스텝`,
    direct: "직접",
    secondDeg: "2단계",

    refreshing: "새로고침 중...",
    unableToLoad: "대시보드 데이터를 불러올 수 없습니다.",
    retry: "다시 시도",
    noData: "이 기간에는 지갑에 대한 데이터가 없습니다.",

    walletCopied: "지갑 주소가 복사되었습니다",
    signFailed: "서명에 실패했습니다. 다시 시도해 주세요.",

    switchLanguageAria: "Switch to English",
  },
};

const LangContext = React.createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Strings;
}>({ lang: "en", setLang: () => {}, t: TRANSLATIONS.en });

function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "ko" || stored === "en") setLangState(stored);
  }, []);

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    }
  }, []);

  const value = React.useMemo(
    () => ({ lang, setLang, t: TRANSLATIONS[lang] }),
    [lang, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function useLang() {
  return React.useContext(LangContext);
}

function LangToggle() {
  const { lang, setLang, t } = useLang();
  const next: Lang = lang === "en" ? "ko" : "en";
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setLang(next)}
      className="border-border/20 dark:border-border/40 gap-1.5 px-2.5"
      aria-label={t.switchLanguageAria}
      title={t.switchLanguageAria}
    >
      <span className="text-base leading-none">
        {next === "ko" ? "\u{1F1F0}\u{1F1F7}" : "\u{1F1FA}\u{1F1F8}"}
      </span>
      <span className="text-xs font-mono uppercase">
        {next === "ko" ? "KO" : "EN"}
      </span>
    </Button>
  );
}

// ---- Month filter generation ----

const GENESIS_TIMESTAMP = 1700352000;
const WEEK_SECONDS = 604800;

function getProtocolWeekForDate(date: Date): number {
  const unix = Math.floor(date.getTime() / 1000);
  return Math.floor((unix - GENESIS_TIMESTAMP) / WEEK_SECONDS);
}

function generateMonthOptions(): Array<{
  kind: "month";
  startWeek: number;
  endWeek: number;
  label: string;
  key: string;
}> {
  const now = new Date();
  const options: Array<{
    kind: "month";
    startWeek: number;
    endWeek: number;
    label: string;
    key: string;
  }> = [];

  let cursor = new Date(Date.UTC(2026, 2, 1));
  while (cursor <= now) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstDayNextMonth = new Date(Date.UTC(year, month + 1, 1));
    options.push({
      kind: "month",
      startWeek: getProtocolWeekForDate(firstDay),
      endWeek: getProtocolWeekForDate(firstDayNextMonth) - 1,
      label: firstDay.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      key: `${year}-${month}`,
    });
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return options;
}

// ---- Metric card ----

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
          tone === "success" ? "text-emerald-500" : ""
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-xs leading-5 text-muted-foreground/60">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// ---- Chart tooltip ----

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card px-3 py-2.5">
      <div className="mb-1.5 text-xs font-mono font-medium">{label}</div>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center gap-2 text-xs leading-5"
        >
          <div
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground/60 dark:text-muted-foreground/80">{entry.name}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {`$${entry.value.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Auth gate ----

function AuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (auth: KolAuth) => void;
}) {
  const { t } = useLang();
  const { address, isConnected } = useAccount();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const [isSigning, setIsSigning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Admin mode state: step 1 = password, step 2 = wallet picker
  const [showAdminLogin, setShowAdminLogin] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState("");
  const [adminAuthenticated, setAdminAuthenticated] = React.useState(false);
  const [adminWallet, setAdminWallet] = React.useState(KOL_WALLETS[0]!);
  const [adminError, setAdminError] = React.useState<string | null>(null);

  const isKol = isKolWallet(address);

  const handleSign = React.useCallback(async () => {
    if (!signer || !address) return;
    setIsSigning(true);
    setError(null);
    try {
      const message = `Authenticate as Ambassador for Glow Dashboard\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      onAuthenticated({ walletAddress: address, signature, message });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signFailed);
    } finally {
      setIsSigning(false);
    }
  }, [signer, address, onAuthenticated, t.signFailed]);

  const handleAdminPasswordSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminPassword) return;
      setAdminError(null);
      // Verify password server-side by making a test request
      const res = await fetch("/api/kol/payback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: KOL_WALLETS[0],
          adminPassword,
          rangePreset: "all_time",
        }),
      });
      if (res.ok) {
        setAdminAuthenticated(true);
      } else {
        setAdminError("Invalid password");
      }
    },
    [adminPassword]
  );

  const handleAdminWalletSelect = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onAuthenticated({ walletAddress: adminWallet, adminPassword });
    },
    [adminWallet, adminPassword, onAuthenticated]
  );

  // Admin login: step 1 - password
  if (showAdminLogin && !adminAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <form
          onSubmit={handleAdminPasswordSubmit}
          className="w-full max-w-sm space-y-4"
        >
          <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Enter the admin password to continue.
          </p>
          <Input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          {adminError && (
            <p className="text-sm text-red-500">{adminError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!adminPassword}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAdminLogin(false);
                setAdminPassword("");
                setAdminError(null);
              }}
              className="border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
            >
              Back
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Admin login: step 2 - wallet picker (only after password verified)
  if (showAdminLogin && adminAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <form
          onSubmit={handleAdminWalletSelect}
          className="w-full max-w-sm space-y-4"
        >
          <h1 className="text-2xl font-bold tracking-tight">Select Ambassador</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Choose an ambassador wallet to view their dashboard.
          </p>
          <select
            value={adminWallet}
            onChange={(e) => setAdminWallet(e.target.value)}
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm font-mono transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            {KOL_WALLETS.map((w) => (
              <option key={w} value={w}>
                {formatWallet(w)}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            View Dashboard
          </Button>
        </form>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="relative flex min-h-[60vh] flex-col items-center justify-between py-16">
        <div className="absolute right-0 top-4">
          <LangToggle />
        </div>
        <div />
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            {t.connectPrompt}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdminLogin(true)}
          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
        >
          Admin
        </button>
      </div>
    );
  }

  if (!isKol) {
    return (
      <div className="relative flex min-h-[60vh] flex-col items-center justify-between py-16">
        <div className="absolute right-0 top-4">
          <LangToggle />
        </div>
        <div />
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {t.accessDeniedTitle}
          </h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            {t.accessDeniedPrefix}
            <span className="font-mono text-sm">{formatWallet(address!)}</span>
            {t.accessDeniedSuffix}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdminLogin(true)}
          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
        >
          Admin
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[50vh] items-center justify-center">
      <div className="absolute right-0 top-4">
        <LangToggle />
      </div>
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.pageTitle}</h1>
        <p className="text-muted-foreground">
          {t.signPromptPrefix}
          <span className="font-mono text-sm">{formatWallet(address!)}</span>
          {t.signPromptSuffix}
        </p>
        <Button
          onClick={handleSign}
          disabled={isSigning || isSignerLoading}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {isSigning ? t.signing : t.verifyButton}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ---- Single-Ambassador Dashboard View ----

type KolData = NonNullable<KolDashboardResponse["kol"]>;

function KolDashboardView({ auth }: { auth: KolAuth }) {
  const { t } = useLang();
  const [filter, setFilter] = React.useState<KolDashboardFilter>({
    kind: "all_time",
  });
  const [isFilterPending, startFilterTransition] = React.useTransition();
  const monthOptions = React.useMemo(() => generateMonthOptions(), []);

  const { data, isLoading, isError, isFetching, refetch } = useKolDashboard(
    auth,
    filter
  );

  const kol = data?.kol;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground/60">
            {t.subtitlePrefix}{" "}
            <CopyableWallet wallet={auth.walletAddress} className="text-sm" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {monthOptions.map((option) => {
            const isActive =
              filter.kind === "month" &&
              filter.startWeek === option.startWeek &&
              filter.endWeek === option.endWeek;
            return (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                disabled={isFilterPending}
                onClick={() =>
                  startFilterTransition(() => setFilter(option))
                }
                className={
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "border-border/20 dark:border-border/40"
                }
              >
                {option.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={filter.kind === "all_time" ? "default" : "outline"}
            disabled={isFilterPending}
            onClick={() =>
              startFilterTransition(() => setFilter({ kind: "all_time" }))
            }
            className={
              filter.kind === "all_time"
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "border-border/20 dark:border-border/40"
            }
          >
            {t.allTime}
          </Button>
          <LangToggle />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/20 p-5 dark:border-border/40"
              >
                <Skeleton className="h-3 w-24 bg-muted/50" />
                <Skeleton className="mt-3 h-8 w-28 bg-muted/50" />
                <Skeleton className="mt-2 h-3 w-32 bg-muted/50" />
              </div>
            ))}
          </div>
          <Skeleton className="h-52 w-full rounded-2xl bg-muted/50" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border border-border/20 p-6 text-center text-sm text-muted-foreground/60 dark:border-border/40">
          <div>{t.unableToLoad}</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            {t.retry}
          </Button>
        </div>
      ) : !kol ? (
        <div className="rounded-2xl border border-border/20 p-6 text-center text-sm text-muted-foreground/60 dark:border-border/40">
          {t.noData}
        </div>
      ) : (
        <KolContent
          kol={kol}
          range={data.range}
          program={data.program}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}

function KolContent({
  kol,
  range,
  program,
  isFetching,
}: {
  kol: KolData;
  range: KolDashboardResponse["range"];
  program: KolDashboardResponse["program"];
  isFetching: boolean;
}) {
  const { lang, t } = useLang();
  const totalSales =
    kol.attributionBreakdown.direct.saleCount +
    kol.attributionBreakdown.secondDegree.saleCount;

  const currentWeek = getProtocolWeekForDate(new Date());

  // Only include weeks that have started (current + past)
  const activeWeeks = kol.weeks.filter((w) => w.weekNumber <= currentWeek);

  // Chart data — exclude the in-progress current week so the miner-sales line
  // doesn't dip to $0 just because the week hasn't finished. The weekly
  // breakdown table below still shows the in-progress week with an
  // "In progress" badge.
  const chartData = activeWeeks
    .slice()
    .filter((w) => w.weekNumber < currentWeek)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => ({
      name: `W${w.weekNumber}`,
      volume: Math.round(
        Number(formatUnits(BigInt(w.totalMinerSalesRaw), 6))
      ),
      delegatedUsd: Math.round(
        Number(
          formatUnits(
            BigInt(w.rolling30DayDelegation.totalDelegatedUsdMicros ?? "0"),
            6
          )
        )
      ),
    }));

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label={t.sales}
          value={totalSales}
          hint={t.saleAttributionHint(
            kol.attributionBreakdown.direct.saleCount,
            kol.attributionBreakdown.secondDegree.saleCount
          )}
        />
        <MetricCard
          label={t.volume}
          value={formatUsdFromRawUsdc6(kol.totalMinerSalesRaw)}
          hint={t.weekRangeHint(range.startWeek, range.endWeek)}
        />
        <MetricCard
          label={t.payback}
          value={formatUsdFromRawUsdc6(kol.totalPaybackRaw)}
          hint={t.baseCommissionHint(program.baseCommissionPercent)}
          tone="success"
        />
        <MetricCard
          label={t.rolling30dDelegated}
          value={`$${Number(
            formatUnits(
              BigInt(
                kol.rolling30DayDelegation.totalDelegatedUsdMicros ?? "0"
              ),
              6
            )
          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          hint={t.delegators(kol.rolling30DayDelegation.uniqueDelegators)}
        />
        <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
            {t.paybackRate}
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
            5%
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs leading-5 text-muted-foreground/60">
            <div>
              {t.delegationBonus(
                formatPercentValue(
                  kol.rolling30DayDelegation.ecosystemBonusPercent
                )
              )}
            </div>
            {Number(kol.rolling30DayDelegation.flatBonusPercent ?? 0) > 0 && (
              <div>
                {t.uncertaintyBonus(
                  formatPercentValue(
                    kol.rolling30DayDelegation.flatBonusPercent ?? "0"
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Network bonus card — only shown for ambassadors who recruited other ambassadors */}
      {kol.masterReferrerOverride && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-1 rounded-full bg-amber-500/70" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {t.networkBonus}
            </span>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {t.networkBonusHeadline(
                    kol.masterReferrerOverride.overridePercent
                  )}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  {t.networkBonusDescription(
                    formatDate(kol.masterReferrerOverride.startedAt, lang),
                    kol.masterReferrerOverride.startedAtWeek
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right md:gap-6">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                    {t.yourBase}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {formatUsdFromRawUsdc6(
                      kol.masterReferrerOverride.basePaybackRaw
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
                    {t.bonus}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-amber-500">
                    +
                    {formatUsdFromRawUsdc6(
                      kol.masterReferrerOverride.overrideRaw
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                    {t.total}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-emerald-500">
                    {formatUsdFromRawUsdc6(kol.totalPaybackRaw)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      {chartData.length > 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Miner Sales Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-1 rounded-full bg-zinc-500/70" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t.minerSales}
              </span>
            </div>
            <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border)/0.2)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    name={t.minerSales}
                    stroke="#71717a"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#71717a" }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center justify-center text-xs text-muted-foreground/60">
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-4 rounded-full bg-[#71717a]" />
                  {t.minerSalesLegend}
                </span>
              </div>
            </div>
          </div>

          {/* Delegated USD Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-1 rounded-full bg-emerald-500/70" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t.delegated30D}
              </span>
            </div>
            <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border)/0.2)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="delegatedUsd"
                    name={t.delegated30D}
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center justify-center text-xs text-muted-foreground/60">
                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-4 rounded-full bg-[#10b981]" />
                  {t.delegated30DLegend}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Breakdown Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-1 rounded-full bg-foreground/70" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t.weeklyBreakdown}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/20 dark:border-border/40 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-4">{t.weekColumn}</TableHead>
                <TableHead className="text-right">{t.salesColumn}</TableHead>
                <TableHead className="text-right">{t.volumeColumn}</TableHead>
                <TableHead className="text-right">{t.paybackColumn}</TableHead>
                <TableHead className="text-right pr-4">
                  {t.delegated30DColumn}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeWeeks
                .slice()
                .sort((a, b) => b.weekNumber - a.weekNumber)
                .map((week) => {
                  const isCurrentWeek = week.weekNumber === currentWeek;

                  return (
                    <React.Fragment key={week.weekNumber}>
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {t.weekLabel(week.weekNumber)}
                            </span>
                            {isCurrentWeek && (
                              <Badge variant="outline" className="border-border/20 dark:border-border/40 text-[10px] font-mono">
                                {t.inProgress}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            {formatDate(week.startAt, lang)} -{" "}
                            {formatDate(week.endAt, lang)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums">
                          {week.saleCount}
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums">
                          {formatUsdFromRawUsdc6(week.totalMinerSalesRaw)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums text-emerald-500">
                          {formatUsdFromRawUsdc6(week.totalPaybackRaw)}
                          {week.masterReferrerOverride &&
                            week.masterReferrerOverride.eligible &&
                            BigInt(week.masterReferrerOverride.overrideRaw) > 0n && (
                              <div className="text-[10px] font-normal text-amber-500/80">
                                {t.inclBonus(
                                  formatUsdFromRawUsdc6(
                                    week.masterReferrerOverride.overrideRaw
                                  )
                                )}
                              </div>
                            )}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-4 tabular-nums">
                          {formatUsdFromRawUsdc6(
                            week.rolling30DayDelegation.totalDelegatedUsdMicros ?? "0"
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expandable sale rows */}
                      {week.sales.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="p-0">
                            <details className="group">
                              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground/50 transition-colors marker:content-none hover:text-muted-foreground/70">
                                <span className="transition group-open:rotate-90">&#9654;</span>
                                {t.salesCount(week.sales.length)}
                              </summary>
                              <div className="border-t border-border/10 dark:border-border/20">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                      <TableHead className="px-4 text-[10px]">{t.typeHeader}</TableHead>
                                      <TableHead className="text-[10px]">{t.buyerHeader}</TableHead>
                                      <TableHead className="text-[10px]">{t.farmHeader}</TableHead>
                                      <TableHead className="text-right text-[10px]">{t.amountHeader}</TableHead>
                                      <TableHead className="text-right text-[10px]">{t.paybackHeader}</TableHead>
                                      <TableHead className="text-[10px] pr-4">{t.dateHeader}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {week.sales.map((sale) => (
                                      <TableRow key={sale.transactionHash} className="text-xs">
                                        <TableCell className="px-4 py-2">
                                          <Badge
                                            variant="outline"
                                            className="border-border/20 text-[10px] font-mono dark:border-border/40"
                                          >
                                            {sale.attributionType === "direct_kol" ? t.direct : t.secondDeg}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <CopyableWallet wallet={sale.buyer} className="text-[10px]" />
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="font-medium">{sale.farmName ?? "\u2014"}</div>
                                          <div className="text-[10px] text-muted-foreground/50">{t.stepsCount(sale.stepsPurchased)}</div>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-medium tabular-nums">
                                          {formatUsdFromRawUsdc6(sale.amountRaw)}
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-medium tabular-nums text-emerald-500">
                                          {formatUsdFromRawUsdc6(sale.paybackRaw)}
                                        </TableCell>
                                        <TableCell className="py-2 pr-4">
                                          {formatDateTime(sale.saleAt, lang)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {isFetching && (
        <div className="text-xs text-muted-foreground/50">{t.refreshing}</div>
      )}
    </>
  );
}

// ---- Main export ----

export function KolDashboard() {
  const [auth, setAuth] = React.useState<KolAuth | null>(null);

  return (
    <LangProvider>
      {!auth ? (
        <AuthGate onAuthenticated={setAuth} />
      ) : (
        <KolDashboardView auth={auth} />
      )}
    </LangProvider>
  );
}
