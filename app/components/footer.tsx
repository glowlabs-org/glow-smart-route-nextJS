"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlowSymbol } from "@/components/glow-symbol";
import { GlowWordmark } from "@/components/glow-wordmark";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function Footer({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="glow-gradient-a  text-glow-black relative rounded-md">
      {children}
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-6 md:px-12 xl:px-16 py-4 md:py-12 relative z-10">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-6 md:mb-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Left Section - Logo and Tagline */}
          <motion.div variants={itemVariants} className="lg:col-span-10">
            <div className="flex items-start justify-between lg:justify-start">
              <div className="flex-1">
                <GlowWordmark className="w-16 h-16 md:w-32 md:h-32 text-glow-black md:mb-6" />
                <p className="text-glow-black/80 glow-body text-lg md:text-xl max-w-[200px] md:max-w-lg">
                  A community working together to build a more sustainable
                  energy grid
                </p>
              </div>

              {/* Glow Symbol - Mobile positioning */}
              <div className="lg:hidden ml-6">
                <GlowSymbol className="w-16 h-16 md:w-32 md:h-32 text-glow-black" />
              </div>
            </div>
            {/* <p className="text-glow-black/60 glow-body font-light text-base">
              contact@glow.org
            </p> */}
          </motion.div>

          {/* Right Section - Glow Symbol Desktop */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:flex lg:col-span-2 justify-end items-start"
          >
            <GlowSymbol className="w-16 h-16 md:w-32 md:h-32 text-glow-black" />
          </motion.div>
        </motion.div>

        {/* Middle Section - Navigation Links */}
        <motion.div
          variants={itemVariants}
          className="mt-16 md:mt-24 lg:mt-32 flex justify-between items-center"
        >
          <div className="flex flex-wrap gap-3 sm:gap-4 md:gap-6 lg:gap-8">
            <Link
              href="/audits"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Audits
            </Link>
            <Link
              href="/branding"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Branding
            </Link>
            <Link
              href="/press"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Press
            </Link>
            <Link
              href="/blog"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Blog
            </Link>
            <Link
              href="/subscribe"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Impact Subscription
            </Link>
            <a
              href="mailto:partnerships@glow.org"
              className="text-glow-black/80 hover:text-glow-black transition-colors text-sm md:text-base"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 300,
              }}
            >
              Partnerships
            </a>
          </div>

          {/* Social Media Icons */}
          <div className="flex gap-3 sm:gap-4">
            {/* <a
              href="https://linkedin.com/company/glow-labs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="LinkedIn"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a> */}
            <a
              href="https://github.com/glowlabs-org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://discord.gg/glowfnd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="Discord"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z" />
              </svg>
            </a>
            <a
              href="https://x.com/glowFND"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* <a
              href="https://youtube.com/@glowlabs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="YouTube"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a> */}
            {/* <a
              href="https://instagram.com/glowlabs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-glow-black/60 hover:text-glow-black transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a> */}
          </div>
        </motion.div>

        <div className="h-px bg-glow-black/10 w-full my-4" />

        {/* Bottom Section - Copyright and Social/Legal Links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 md:gap-8">
            {/* Copyright */}
            <div>
              <p className="text-glow-black/90 text-sm md:text-base">
                ©2025 Glow. All rights reserved.
              </p>
            </div>

            {/* Social Media Icons and Legal Links */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8 items-start sm:items-center">
              {/* Legal Links */}
              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm text-glow-black/50">
                <Link
                  href="/privacy-notice"
                  className="hover:text-glow-black transition-colors"
                >
                  Privacy Notice
                </Link>
                <Link
                  href="/cookie-policy"
                  className="hover:text-glow-black transition-colors"
                >
                  Cookie Policy
                </Link>
                <Link
                  href="/terms-of-use"
                  className="hover:text-glow-black transition-colors"
                >
                  Terms of Use
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
