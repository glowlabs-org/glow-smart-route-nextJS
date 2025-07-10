import "./globals.css";

import { Toaster } from "sonner";
import { WagmiWrapper } from "./providers/wagmiWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <WagmiWrapper>
          {children}
          <Toaster position="bottom-right" />
        </WagmiWrapper>
      </body>
    </html>
  );
}
