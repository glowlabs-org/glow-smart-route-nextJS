// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { configureSentry } from "@glowlabs-org/utils/browser";
import * as Sentry from "@sentry/nextjs";

if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: "https://1334fda901e8976224deb1286b64c68f@o4507374658846720.ingest.us.sentry.io/4510134559375360",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Drop events generated when running a production build locally
    // (e.g. `pnpm start` on a developer machine). These hit Sentry because
    // NODE_ENV is production but represent local traffic, not real users.
    beforeSend(event) {
      const requestUrl =
        typeof event.request?.url === "string" ? event.request.url : "";
      const isLocalhostRequest =
        /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/.test(
          requestUrl
        );
      if (isLocalhostRequest) return null;

      const serverName =
        typeof event.server_name === "string" ? event.server_name : "";
      if (serverName.endsWith(".local")) return null;

      return event;
    },
  });

  configureSentry({
    enabled: true,
    client: Sentry as unknown as Parameters<
      typeof configureSentry
    >[0]["client"],
    defaultContext: { runtime: "server" },
  });
}
