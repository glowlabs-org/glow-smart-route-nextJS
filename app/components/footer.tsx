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
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-6 md:px-12 xl:px-16 py-8 md:py-12 relative z-10">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-6 md:mb-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Left Section - Logo and Tagline */}
          <motion.div variants={itemVariants} className="lg:col-span-10">
            <GlowWordmark className="w-16 h-16 md:w-32 md:h-32 text-glow-black" />
            <p className="text-glow-black/80 glow-body text-lg md:text-xl mb-4 max-w-lg">
              A community working together to build a more sustainable energy
              grid
            </p>
          </motion.div>

          {/* Right Section - Glow Symbol */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 flex justify-start lg:justify-end items-start"
          >
            <GlowSymbol className="w-16 h-16 md:w-32 md:h-32 text-glow-black" />
          </motion.div>
        </motion.div>

        <div className="h-px bg-glow-black/10 w-full my-4" />

        {/* Bottom Section - Copyright and Social/Legal Links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 md:gap-8">
            {/* Copyright */}
            <div>
              <p className="text-glow-black/80 text-sm md:text-base">
                Community-owned.
              </p>
            </div>

            {/* Social Media Icons and Legal Links */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8 items-start sm:items-center">
              {/* Legal Links */}
              <div className="flex flex-wrap gap-4 text-sm text-glow-black/60">
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
