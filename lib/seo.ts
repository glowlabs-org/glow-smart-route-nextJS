import type { Metadata } from "next";

export const SEO = {
  siteName: "Glow Mining",
  siteUrl: "https://app.glow.org",
  defaultTitle: "Glow Mining - Solar Farm Sponsorship & GLW Token Rewards",
  defaultDescription:
    "Participate in Glow's decentralized solar mining ecosystem. Sponsor solar farms through the Glow Launchpad, earn GLW tokens through the Mining Center, and support renewable energy infrastructure while earning rewards.",
} as const;

export function buildPageMetadata(options: {
  title: string;
  description?: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const { title, description, path, noIndex } = options;
  const resolvedDescription = description ?? SEO.defaultDescription;
  const url = new URL(path, SEO.siteUrl).toString();
  const fullTitle = `${title} | ${SEO.siteName}`;

  const metadata: Metadata = {
    title,
    description: resolvedDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description: resolvedDescription,
      url,
      siteName: SEO.siteName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: resolvedDescription,
    },
  };

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}
