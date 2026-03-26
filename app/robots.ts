import type { MetadataRoute } from "next";
import { SEO } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/internal",
        "/test",
        "/r",
        "/share",
        "/glow-swap",
        "/liquidity",
      ],
    },
    sitemap: `${SEO.siteUrl}/sitemap.xml`,
  };
}
