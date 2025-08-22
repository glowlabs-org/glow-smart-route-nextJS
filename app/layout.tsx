import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { WagmiWrapper } from "./providers/wagmiWrapper";
import { ThemeProvider } from "./providers/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
        <ThemeProvider attribute="class" defaultTheme="light">
          <WagmiWrapper>
            <NuqsAdapter>{children}</NuqsAdapter>
            <Toaster position="bottom-right" />
          </WagmiWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
