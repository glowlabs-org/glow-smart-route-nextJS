import "@/lib/server-web-storage";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WagmiWrapper } from "./providers/wagmiWrapper";
import { ThemeProvider } from "./providers/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import { Metadata } from "next";
import { SEO } from "@/lib/seo";

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
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
      </head>
      <body className={`antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <WagmiWrapper>
            <Analytics />
            <NuqsAdapter>{children}</NuqsAdapter>
          </WagmiWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
