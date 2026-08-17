import "@/lib/server-web-storage";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WagmiWrapper } from "./providers/wagmiWrapper";
import { ThemeProvider } from "./providers/theme-provider";
import { LangProvider } from "@/lib/i18n";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { Metadata } from "next";
import { preconnect } from "react-dom";
import { SEO } from "@/lib/seo";

// Origins the app connects to immediately on most pages (backend APIs + RPC).
// Preconnecting starts DNS+TCP+TLS before the first fetch/RPC call, shaving
// ~100-300ms off initial data load. Derived from env so it follows staging/prod;
// `URL(...).origin` strips any path/API-key, so only the bare origin is hinted.
function toOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const PRECONNECT_ORIGINS = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_HUB_URL,
      process.env.NEXT_PUBLIC_CONTROL_API_URL,
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
      process.env.NEXT_PUBLIC_MAINNET_RPC_FALLBACK_URL,
    ]
      .map(toOrigin)
      .filter((origin): origin is string => origin !== null)
  )
);

export const metadata: Metadata = {
  title: {
    default: SEO.defaultTitle,
    template: `%s | ${SEO.siteName}`,
  },
  description: SEO.defaultDescription,
  keywords: [
    "Glow mining",
    "solar mining",
    "GLW tokens",
    "solar farm sponsorship",
    "renewable energy",
    "DeFi mining",
    "protocol deposits",
    "carbon credits",
    "green energy",
    "sustainability",
    "blockchain solar",
    "Glow Launchpad",
    "Mining Center",
    "deposit mining",
    "solar farm installer",
    "climate finance",
    "clean energy rewards",
    "solar infrastructure",
    "Glow protocol",
  ],
  authors: [{ name: "Glow Labs" }],
  creator: "Glow Labs",
  publisher: "Glow Labs",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SEO.siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    url: SEO.siteUrl,
    siteName: SEO.siteName,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Glow Mining",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
  },
};
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Emit <link rel="preconnect"> for backend/RPC origins before render.
  for (const origin of PRECONNECT_ORIGINS) {
    preconnect(origin);
  }

  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* Disable page translation (Google Translate / Chrome). Translators
            rewrite text nodes out from under React, causing NotFoundError
            insertBefore crashes in the commit phase (Sentry APP-GLOW-ORG-6S). */}
        <meta name="google" content="notranslate" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SEO.siteUrl}/#organization`,
                  name: "Glow Labs",
                  url: SEO.siteUrl,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SEO.siteUrl}/Chrome_512x512.png`,
                  },
                  sameAs: [
                    "https://twitter.com/glaboratory",
                    "https://discord.gg/glow",
                  ],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SEO.siteUrl}/#website`,
                  url: SEO.siteUrl,
                  name: SEO.siteName,
                  publisher: { "@id": `${SEO.siteUrl}/#organization` },
                  description: SEO.defaultDescription,
                },
              ],
            }),
          }}
        />

        {/* Favicon and Icons */}
        <link rel="icon" type="image/png" sizes="16x16" href="/16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/32x32.png" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/Apple_Touch_180x180.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/Chrome_192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="512x512"
          href="/Chrome_512x512.png"
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme and Mobile Optimization */}
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />

        {/* Viewport */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* Umami analytics (production only). Reverted from recorder.js to
            script.js to test whether the larger rrweb bundle was failing to
            init in real browsers. Replays disabled while we diagnose the
            Vercel-vs-Umami capture-rate gap. */}
        {process.env.NODE_ENV === "production" && (
          <Script
            src="https://umami-production-c5d3.up.railway.app/script.js"
            data-website-id="80e6d736-7ef9-4ae8-9db0-b47cf730702d"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LangProvider>
            <WagmiWrapper>
              <NuqsAdapter>{children}</NuqsAdapter>
            </WagmiWrapper>
          </LangProvider>
        </ThemeProvider>
        {/* Vercel Web Analytics — basic visitor + pageview tracking only.
            Custom events are sent to Umami exclusively (lib/telemetry.ts). */}
        <Analytics />
      </body>
    </html>
  );
}
