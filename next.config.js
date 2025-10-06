/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
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
  return isProdBuild
    ? withSentryConfig(nextConfig, {
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
    : nextConfig;
};
