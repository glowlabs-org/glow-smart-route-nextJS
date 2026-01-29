"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

interface BlogFeaturedWidgetProps {
  className?: string;
}

export default function BlogFeaturedWidget({
  className,
}: BlogFeaturedWidgetProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "blog_featured_widget";

  const post = {
    slug: "capital-efficiency-in-the-glow-economy",
    title: "Delegate or Mine? Capital Efficiency in the Glow Economy",
    description:
      "Optimizing your participation and rewards in the on-chain solar economy",
    category: "Protocol",
    readTime: "7 min read",
    author: {
      name: "Vik Kalghatgi",
      role: "Chief Scientist",
    },
    publishedAt: "2026-01-29",
    image: "/images/capital-efficiency-header.jpg",
    url: "https://glow.org/blog/capital-efficiency-in-the-glow-economy",
  };

  return (
    <Link
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group block h-full w-full", className)}
      onClick={() => {
        trackEvent("dashboard_blog_click", {
          source,
          wallet_connected: isConnected,
          wallet_address: walletAddress,
          article_slug: post.slug,
          article_url: post.url,
        });
      }}
    >
      <div className="relative h-full w-full rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 bg-muted border border-border/20 dark:border-border/40">
        {/* Background Image */}
        <Image
          src={post.image}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black/90" />

        {/* Featured/Category Badge */}
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10">
          <span className="bg-white/90 dark:bg-white/80 text-black px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-widest backdrop-blur-sm rounded-lg">
            {post.category}
          </span>
        </div>

        {/* Arrow Icon */}
        <ArrowUpRight
          strokeWidth={1.5}
          className="absolute right-4 top-4 w-5 h-5 md:w-6 md:h-6 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 text-white/80 z-10"
        />

        {/* Content Overlay */}
        <div className="relative z-10 p-5 md:p-6 h-full flex flex-col justify-end text-white">
          {/* Metadata */}
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-white/70 mb-3">
            <time dateTime={post.publishedAt}>Jan 29, 2026</time>
            <span aria-hidden="true">•</span>
            <span>{post.readTime}</span>
          </div>

          {/* Title */}
          <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-white group-hover:text-white/90 transition-colors duration-300 mb-2 line-clamp-2 leading-tight tracking-tight">
            {post.title}
          </h3>

          {/* Description */}
          <p className="text-white/80 line-clamp-2 mb-4 text-sm leading-relaxed">
            {post.description}
          </p>

          {/* Author */}
          <div className="flex items-center gap-2 text-xs font-mono text-white/70">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] text-white font-semibold">
              {post.author.name.charAt(0)}
            </div>
            <span>{post.author.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
