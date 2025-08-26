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

module.exports = nextConfig;
