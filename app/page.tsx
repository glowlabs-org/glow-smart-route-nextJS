import { QueryClient, dehydrate } from "@tanstack/react-query";
import { getCachedHeadlineStats } from "@/lib/server/headline-stats";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { prefetchDashboardLaunchpadData } from "@/lib/server/dashboard-launchpad-prefetch";
import { prefetchHomeProtocolMetricsData } from "@/lib/server/home-protocol-metrics-prefetch";
import { PageWrapper } from "./components/page-wrapper";
import { HydrationWrapper } from "./components/hydration-wrapper";
import { Header } from "@/components/header";
import GlowSoftDashboard from "./test/bento";

export const revalidate = 30;

function PageContent() {
  return (
    <>
      <Header />
      <GlowSoftDashboard />
    </>
  );
}

export default async function HomePage() {
  const queryClient = new QueryClient();
  const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["headline-stats", chainId],
      queryFn: async () => await getCachedHeadlineStats(),
      staleTime: 30_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["eth-price"],
      queryFn: getEthPriceInUSD,
      staleTime: 60_000,
    }),
    prefetchDashboardLaunchpadData(queryClient),
  ]);

  const headlineStats = queryClient.getQueryData<
    Awaited<ReturnType<typeof getCachedHeadlineStats>>
  >(["headline-stats", chainId]);

  await prefetchHomeProtocolMetricsData(queryClient, {
    headlineStats: headlineStats ?? null,
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationWrapper state={dehydratedState}>
      <PageWrapper>
        <PageContent />
      </PageWrapper>
    </HydrationWrapper>
  );
}
