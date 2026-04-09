import type { Metadata } from "next";
import { Header } from "@/components/header";
import { KolDashboard } from "./kol-dashboard";

export const metadata: Metadata = {
  title: "Ambassador Dashboard | Glow Mining",
  description: "Commission tracking and performance metrics for Glow Ambassadors",
  robots: { index: false, follow: false },
};

export default function KolPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <div className="min-h-screen bg-background">
        <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
          <KolDashboard />
        </section>
      </div>
    </>
  );
}
