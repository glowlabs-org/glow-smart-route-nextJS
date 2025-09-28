import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { WagmiWrapper } from "./providers/wagmiWrapper";
import { ThemeProvider } from "./providers/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glow Mining - Solar Farm Sponsorship & GLW Token Rewards",
  description:
    "Participate in Glow's decentralized solar mining ecosystem. Sponsor solar farms through the Glow Launchpad, earn GLW tokens through the Mining Center, and support renewable energy infrastructure while earning rewards.",
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
  metadataBase: new URL("https://app.glow.org"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Glow Mining - Solar Farm Sponsorship & GLW Token Rewards",
    description:
      "Join Glow's decentralized solar mining ecosystem. Sponsor competitive solar farms, earn GLW tokens, and support renewable energy infrastructure through the Glow Launchpad and Mining Center.",
    url: "https://app.glow.org",
    siteName: "Glow Mining Platform",
    images: [
      {
        url: "/Chrome_512x512.png",
        width: 512,
        height: 512,
        alt: "Glow Mining - Solar Farm Sponsorship Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glow Mining - Sponsor Solar Farms & Earn GLW Tokens",
    description:
      "Participate in decentralized solar mining. Sponsor solar farms through the Glow Launchpad, earn GLW tokens through the Mining Center, and support renewable energy while earning rewards.",
    images: ["/Chrome_512x512.png"],
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
            <Toaster position="bottom-right" />
          </WagmiWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
