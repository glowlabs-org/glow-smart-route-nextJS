// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { configureSentry } from "@glowlabs-org/utils/browser";
import * as Sentry from "@sentry/nextjs";

if (process.env.NODE_ENV === "production") {
  if (
    !process.env.NEXT_PUBLIC_CONTROL_API_URL ||
    !process.env.NEXT_PUBLIC_HUB_URL
  ) {
    throw new Error("Missing environment variables");
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const controlApiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL!;
  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL!;
  Sentry.init({
    dsn: "https://1334fda901e8976224deb1286b64c68f@o4507374658846720.ingest.us.sentry.io/4510134559375360",

    // Add optional integrations for additional features
    integrations: [
      Sentry.replayIntegration({
        networkDetailAllowUrls: [controlApiUrl, hubUrl],
        networkRequestHeaders: ["Authorization"],
        networkResponseHeaders: ["Authorization"],
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,
    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Filter out errors from browser extensions and transient chunk loading failures
    beforeSend(event) {
      // Filter info-level events (performance observations, not errors)
      if (event.level === "info") return null;

      const frames =
        event.exception?.values?.[0]?.stacktrace?.frames || [];
      const message =
        event.exception?.values?.[0]?.value || event.message || "";

      // Filter browser extension errors (crypto wallets, etc.)
      const isExtensionError = frames.some(
        (frame) =>
          frame.filename?.includes("inpage.js") ||
          frame.filename?.startsWith("chrome-extension://") ||
          frame.filename?.startsWith("moz-extension://")
      );
      if (isExtensionError) return null;

      // Filter transient chunk loading failures (network issues, Safari race conditions)
      const isChunkLoadError =
        message.includes("e[o].call") ||
        message.includes("Loading chunk") ||
        message.includes("ChunkLoadError");
      if (isChunkLoadError) return null;

      // Filter wallet rejection errors (user declined connection/signature)
      const isWalletRejection =
        message.includes("Object captured as promise rejection with keys: code, message") ||
        message.includes("User rejected") ||
        message.includes("user rejected");
      if (isWalletRejection) return null;

      // Filter a known noisy client-side error coming from Sentry Replay network scrapers
      // (e.g. `app:///scrapers/PrebidScraper.js`) attempting to JSON.parse an undefined
      // request/response body.
      const isReplayScraperFrame = frames.some((frame) => {
        const filename = frame.filename || "";
        const absPath = frame.abs_path || "";
        const frameModule = frame.module || "";
        return (
          filename.includes("/scrapers/") ||
          absPath.includes("/scrapers/") ||
          frameModule.includes("scrapers/")
        );
      });
      const isUndefinedJsonParse =
        message.includes('"undefined" is not valid JSON') ||
        message.includes("undefined is not valid JSON");
      if (isReplayScraperFrame && isUndefinedJsonParse) return null;

      return event;
    },
  });

  configureSentry({
    enabled: true,
    client: Sentry as unknown as Parameters<
      typeof configureSentry
    >[0]["client"],
    defaultContext: {
      app: "web",
      env: process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "mainnet" : "sepolia",
    },
  });
}

export const onRouterTransitionStart =
  process.env.NODE_ENV === "production"
    ? Sentry.captureRouterTransitionStart
    : (..._args: unknown[]) => {};
