import { QueryClient, dehydrate } from "@tanstack/react-query";
import { HydrationWrapper } from "@/app/components/hydration-wrapper";
import { prefetchDashboardLaunchpadData } from "@/lib/server/dashboard-launchpad-prefetch";
import GlowSoftDashboard from "./bento";

export default async function TestPage() {
  const queryClient = new QueryClient();

  await prefetchDashboardLaunchpadData(queryClient);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationWrapper state={dehydratedState}>
      <GlowSoftDashboard />
    </HydrationWrapper>
  );
}
