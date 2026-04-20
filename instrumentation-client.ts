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

  // Prevent a known noisy unhandledrejection from Sentry Replay network scrapers
  // from reaching Sentry's GlobalHandlers integration.
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;

      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      const stack = reason instanceof Error ? reason.stack || "" : "";

      const isUndefinedJsonParse =
        message.includes('"undefined" is not valid JSON') ||
        message.includes("undefined is not valid JSON");
      const isReplayScraper =
        stack.includes("/scrapers/") ||
        stack.includes("PrebidScraper") ||
        stack.includes("NetworkRequest2Scraper");

      if (isUndefinedJsonParse && isReplayScraper) {
        event.preventDefault();
      }
    },
    { capture: true }
  );

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

      const exceptionValues = event.exception?.values || [];
      // Collect frames across all linked exceptions so a cause buried under
      // a first-party wrapper still matches extension patterns.
      const allFrames = exceptionValues.flatMap(
        (v) => v.stacktrace?.frames || []
      );
      const frames =
        event.exception?.values?.[0]?.stacktrace?.frames || [];
      const message =
        event.exception?.values?.[0]?.value || event.message || "";
      const exceptionText = exceptionValues
        .map((v) => `${v.type ?? ""}: ${v.value ?? ""}`)
        .join("\n");
      const exceptionTypes = exceptionValues.map((v) => v.type || "");

      // Filter browser extension errors (crypto wallets, etc.).
      // Some wallets inject scripts into page context under paths that Sentry
      // surfaces as `app:///...` (e.g. extensionPageScript.js, inpage-solana-early.js,
      // in-page.js, chunk-inject.js), so match those filenames explicitly in
      // addition to the extension:// protocol prefixes.
      const isExtensionError = allFrames.some((frame) => {
        const filename = frame.filename || "";
        return (
          filename.includes("inpage.js") ||
          filename.includes("inpage-solana-early") ||
          filename.includes("extensionPageScript") ||
          filename.includes("chunk-inject") ||
          /\/in-page\.js(\?|$|:)/.test(filename) ||
          filename.startsWith("chrome-extension://") ||
          filename.startsWith("moz-extension://")
        );
      });
      if (isExtensionError) return null;

      // TronLink wallet injects a proxy that rejects `set` for the
      // `tronlinkParams` property. Extension bug, not ours.
      const isTronLinkProxyError =
        /trap returned falsish for property ['"]tronlinkParams['"]/.test(
          message
        );
      if (isTronLinkProxyError) return null;

      // RainbowKit's wallet lookup throws "not found rainbowkit" as an
      // unhandled rejection when a third-party wallet lookup misses. We
      // don't use RainbowKit as a user-facing connector here; it surfaces
      // via connector discovery and is not actionable.
      const isRainbowKitNotFound = /not found rainbowkit/i.test(message);
      if (isRainbowKitNotFound) return null;

      // wagmi throws ProviderNotFoundError from the injected connector's
      // onAccountsChanged handler when a user disconnects their wallet but
      // the connector still fires a stale event. Benign; the UI re-syncs.
      const isProviderNotFound = exceptionTypes.some(
        (t) => t === "ProviderNotFoundError"
      );
      if (isProviderNotFound) return null;

      // viem walks the error cause chain with `'data' in err`, which throws
      // TypeError when a wallet returns a non-object cause (e.g. the string
      // "cancelled"). We cannot fix viem from here, and these only surface on
      // non-conformant wallets during user-initiated actions; drop them.
      const isViemInOperatorWalk =
        /Cannot use 'in' operator to search for ['"]data['"] in/.test(message);
      if (isViemInOperatorWalk) return null;

      // Filter transient chunk loading failures (network issues, Safari race conditions)
      const isChunkLoadError =
        message.includes("e[o].call") ||
        message.includes("Loading chunk") ||
        message.includes("ChunkLoadError");
      if (isChunkLoadError) return null;

      // Filter wallet rejection errors (user declined connection/signature)
      const extraAny = event.extra as any;
      const errorCode =
        extraAny?.errorCode ??
        extraAny?.code ??
        extraAny?.cause?.code ??
        extraAny?.originalException?.code;
      const isWalletRejection =
        message.includes(
          "Object captured as promise rejection with keys: code, message"
        ) ||
        /user rejected/i.test(message) ||
        /user rejected/i.test(exceptionText) ||
        /user denied/i.test(exceptionText) ||
        /transaction canceled/i.test(exceptionText) ||
        /transaction was rejected/i.test(message) ||
        /transaction was rejected/i.test(exceptionText) ||
        /request was rejected/i.test(exceptionText) ||
        errorCode === 4001 ||
        errorCode === "ACTION_REJECTED" ||
        exceptionValues.some((v) => v.type === "UserRejectedRequestError");
      if (isWalletRejection) return null;

      // Filter wallet connectivity / hardware wallet transient errors.
      // These are user-environment issues (device unplugged, transport reset) and are not actionable in Sentry.
      const isWalletConnectivityIssue =
        /device disconnected during action/i.test(message) ||
        /device disconnected during action/i.test(exceptionText) ||
        /device disconnected/i.test(message) ||
        /device disconnected/i.test(exceptionText);
      if (isWalletConnectivityIssue) return null;

      // WalletConnect proposal expiry is a user-driven session timeout
      // regardless of whether it surfaces as handled or unhandled. Always
      // drop so it stops filling the errors dashboard.
      const isWalletConnectProposalExpired =
        /proposal expired/i.test(message) ||
        /proposal expired/i.test(exceptionText);
      if (isWalletConnectProposalExpired) return null;

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
