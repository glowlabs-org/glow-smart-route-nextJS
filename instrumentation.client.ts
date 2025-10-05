import * as Sentry from "@sentry/nextjs";
import { configureSentry } from "@glowlabs-org/utils/browser";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

configureSentry({
  enabled: true,
  client: Sentry as unknown as Parameters<typeof configureSentry>[0]["client"],
  defaultContext: {
    app: "web",
    env: process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "mainnet" : "sepolia",
  },
});
