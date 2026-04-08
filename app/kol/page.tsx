import type { Metadata } from "next";
import { Header } from "@/components/header";
import { KolDashboard } from "./kol-dashboard";

export const metadata: Metadata = {
  title: "KoL Dashboard | Glow Mining",
  description: "Commission tracking and performance metrics for Glow KoLs",
  robots: { index: false, follow: false },
};

export default function KolPage() {
  return (
    <>
      <Header />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <KolDashboard />
      </div>
    </>
  );
}
