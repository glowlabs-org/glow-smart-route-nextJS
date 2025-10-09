/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Broaden support and tune optimization behavior
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24h CDN cache for optimized images
    deviceSizes: [320, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      "images.unsplash.com",
      "lh3.googleusercontent.com",
      "pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev",
      },
      {
        protocol: "https",
        hostname: "silver-managerial-rook-988.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "*.mypinata.cloud",
      },
      // Optional wildcard to support other R2 public buckets if needed
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Handle web workers properly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Configure worker-loader for .worker.js files
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: "worker-loader" },
    });

    // Handle worker files from node_modules
    config.module.rules.push({
      test: /HeartbeatWorker\.js$/,
      type: "javascript/auto",
    });

    // Exclude worker files from being processed by Terser
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === "TerserPlugin") {
          if (!minimizer.options.exclude) {
            minimizer.options.exclude = [];
          }
          minimizer.options.exclude.push(/HeartbeatWorker\.js$/);
        }
      });
    }

    return config;
  },
  // Disable strict mode for better compatibility with dependencies
  reactStrictMode: false,
};

// Injected content via Sentry wizard below
const { PHASE_PRODUCTION_BUILD } = require("next/constants");
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = (phase) => {
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;

  // Disable image optimization only in development to avoid local 500s;
  // production keeps full Next/Image optimization and caching.
  const phasedConfig = {
    ...nextConfig,
    images: {
      ...nextConfig.images,
      unoptimized: !isProdBuild,
    },
  };

  return isProdBuild
    ? withSentryConfig(phasedConfig, {
        // For all available options, see:
        // https://www.npmjs.com/package/@sentry/webpack-plugin#options

        org: "icrg",
        project: "app-glow-org",

        // Only print logs for uploading source maps in CI
        silent: !process.env.CI,

        // For all available options, see:
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

        // Upload a larger set of source maps for prettier stack traces (increases build time)
        widenClientFileUpload: true,

        // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
        // This can increase your server load as well as your hosting bill.
        // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
        // side errors will fail.
        tunnelRoute: "/monitoring",

        // Automatically tree-shake Sentry logger statements to reduce bundle size
        disableLogger: true,

        // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: true,
      })
    : phasedConfig;
};
