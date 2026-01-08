"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogFeaturedWidgetProps {
  className?: string;
}

export default function BlogFeaturedWidget({
  className,
}: BlogFeaturedWidgetProps) {
  const post = {
    slug: "progressive-vaults-transparency",
    title: "Progressive Vaults: Competitive Deposit Recovery in Glow",
    description:
      "How Glow redistributes protocol deposits based on solar farm performance. On Glow, solar farms compete to produce the maximum number of carbon credits relative to their electricity revenues.",
    category: "Protocol",
    readTime: "12 min read",
    author: {
      name: "Vik Kalghatgi",
      role: "Chief Scientist",
    },
    publishedAt: "2025-10-24", // Approximate date for display
    image: "/images/sections/panels-array.jpg",
    url: "https://glow.org/blog/progressive-vaults-transparency",
  };

  return (
    <Link
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group block h-full w-full", className)}
    >
      <div className="relative h-full w-full rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 bg-muted">
        {/* Background Image */}
        <Image
          src={post.image}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

        {/* Featured/Category Badge */}
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10">
          <span className="bg-white/90 text-black px-2 md:px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm rounded-sm">
            {post.category}
          </span>
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 p-5 md:p-8 h-full flex flex-col justify-end text-white">
          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-white/90 mb-3">
            <time dateTime={post.publishedAt} className="font-medium">
              Oct 24, 2025
            </time>
            <span aria-hidden="true">•</span>
            <span className="font-medium">{post.readTime}</span>

            <ArrowUpRight
              strokeWidth={1.5}
              className="absolute right-5 top-5 w-6 h-6 md:w-8 md:h-8 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 text-white opacity-90"
            />
          </div>

          {/* Title */}
          <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white group-hover:text-white/90 transition-colors duration-300 mb-3 line-clamp-2 md:line-clamp-3 leading-tight">
            {post.title}
          </h3>

          {/* Description */}
          <p className="text-white line-clamp-2 md:line-clamp-3 mb-4 text-sm md:text-base leading-relaxed opacity-90">
            {post.description}
          </p>

          {/* Author */}
          <div className="flex items-center gap-2 text-sm text-white/90 font-medium">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] text-white">
              {post.author.name.charAt(0)}
            </div>
            <span>{post.author.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
