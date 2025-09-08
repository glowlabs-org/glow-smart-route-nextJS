"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import Image from "next/image";
import { Header } from "@/components/header";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Top Navigation */}
      <Header withIsScrolled={false} />

      <Image
        src="/images/bg/bg-gradient.png"
        alt="404"
        width={1000}
        height={1000}
        className="absolute top-0 left-0 w-full h-full object-cover"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background to-transparent pointer-events-none" />
        <motion.h1
          className="text-9xl font-bold tracking-tighter text-glow-black dark:text-glow-white md:text-[15rem] relative z-10"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          404
        </motion.h1>
        <motion.p
          className="mt-4 text-2xl font-medium text-glow-black dark:text-glow-white relative z-10"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          This page could not be found
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 relative z-10"
        >
          <Button asChild size="lg">
            <Link href="/">Go back to homepage</Link>
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 text-sm">
        <div className="flex flex-col gap-1">
          <p> ©2025 Glow.</p>
        </div>
        <nav className="flex gap-4">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="https://glow.org/blog" className="hover:underline">
            Blog
          </Link>
          <Link href="https://glow.org/blog/audits" className="hover:underline">
            Audits
          </Link>
        </nav>
        <Link href="https://glow.org/blog/newsletter" className="underline">
          Newsletter
        </Link>
      </footer>
    </div>
  );
}
