import type { MetadataRoute } from "next";
import { SEO } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    { path: "/", priority: 1, changeFrequency: "daily" as const },
    { path: "/stats", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/leaderboard", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/tos", priority: 0.2, changeFrequency: "yearly" as const },
  ];

  return routes.map((route) => ({
    url: `${SEO.siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
