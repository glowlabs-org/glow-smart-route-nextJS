import type { Metadata } from "next";
import { buildPageMetadata, SEO } from "@/lib/seo";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { code } = await params;
  const rawCode = safeDecode(code ?? "");
  const displayCode = rawCode.slice(0, 12).toUpperCase();

  const base = buildPageMetadata({
    title: `Referral Code - ${displayCode}`,
    description: "Join Glow with a referral code and start earning rewards.",
    path: `/r/${encodeURIComponent(code)}`,
    noIndex: true,
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      images: [
        {
          url: `${SEO.siteUrl}/r/${encodeURIComponent(code)}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "Glow Referral",
        },
      ],
    },
    twitter: {
      ...base.twitter,
      images: [`${SEO.siteUrl}/r/${encodeURIComponent(code)}/twitter-image`],
    },
  };
}

export default function ReferralCodeLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
