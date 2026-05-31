// Build the Content-Security-Policy directive list. Kept in Report-Only mode
// initially so violations surface in the browser console without breaking the
// app; flip the header name to `Content-Security-Policy` once the report is
// clean.
const cspDirectives = [
  "default-src 'self'",
  // Next.js + Turbopack rely on inline runtime scripts; some wallet SDKs
  // (Privy, WalletConnect) ship eval-using crypto polyfills.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob:",
  // WalletConnect verification iframe + Cloudflare Turnstile + Stripe checkout.
  "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Wallet + RPC + API endpoints. Localhost entries cover `pnpm dev` against
  // local hub/control backends; railway/alchemy/etc. cover deployed envs.
  [
    "connect-src",
    "'self'",
    "http://localhost:* ws://localhost:*",
    // Privy
    "https://auth.privy.io",
    "https://*.privy.io",
    "https://*.rpc.privy.systems",
    "wss://*.privy.io",
    // WalletConnect
    "wss://relay.walletconnect.com",
    "wss://relay.walletconnect.org",
    "https://relay.walletconnect.com",
    "https://relay.walletconnect.org",
    "https://explorer-api.walletconnect.com",
    "https://pulse.walletconnect.org",
    "https://api.web3modal.org",
    "https://api.web3modal.com",
    // Coinbase Wallet (walletlink)
    "wss://www.walletlink.org",
    "https://*.coinbase.com",
    // RPC providers
    "https://*.alchemy.com",
    "wss://*.alchemy.com",
    "https://*.g.alchemy.com",
    // Glow APIs (railway-hosted prod + staging)
    "https://*.up.railway.app",
    // CDN / asset hosts
    "https://*.r2.dev",
    "https://*.mypinata.cloud",
    // Payments
    "https://api.stripe.com",
    "https://*.crossmint.com",
    "https://*.crossmint.io",
    // Analytics + monitoring
    "https://*.sentry.io",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
  ].join(" "),
];

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Coinbase Smart Wallet (and other popup-based wallet connectors) need
  // window.opener to be accessible from the popup. Without an explicit COOP
  // header, Next 16 / the host platform can apply same-origin isolation that
  // strips window.opener and breaks the connect flow with the
  // "This app doesn't support smart wallets" error.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives.join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["heic-decode"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-icons",
      "framer-motion",
    ],
  },
  async redirects() {
    return [
      {
        source: "/blog/:path*",
        has: [
          {
            type: "host",
            value: "app.glow.org",
          },
        ],
        destination: "https://glow.org/blog/:path*",
        permanent: true,
        basePath: false,
      },
      {
        source: "/audits/:path*",
        has: [
          {
            type: "host",
            value: "app.glow.org",
          },
        ],
        destination: "https://glow.org/audits/:path*",
        permanent: true,
        basePath: false,
      },
      {
        source: "/glow-swap/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/leaderboard",
        destination: "/stats/rewards",
        permanent: true,
      },
    ];
  },
  images: {
    // Broaden support and tune optimization behavior
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24h CDN cache for optimized images
    deviceSizes: [320, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Optional deps pulled in by some wallet SDKs; not needed in our bundles.
      encoding: false,
      "pino-pretty": false,
      // Privy's web bundle references RN + Farcaster mini-app peers that are
      // only used on those platforms. Stub them so Vercel's webpack build
      // doesn't fail on the missing modules.
      "@react-native-async-storage/async-storage": false,
      "@farcaster/mini-app-solana": false,
    };

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
