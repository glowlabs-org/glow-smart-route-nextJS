import "@/app/globals.css";
import clsx from "clsx";
import { Cormorant_Garamond, Lato } from "next/font/google";
// import { Navbar } from "./components/navbar";
// import { Footer } from "./components/footer";
// import { NextAuthProvider } from "./providers/nextAuthProvider";
import { WagmiWrapper } from "./providers/wagmiWrapper";
import { ScrollWrapper } from "./components/scrollWrapper";

export const metadata = {
  title: "Glow ",
  description: "Transforming the world through community-powered solar",
  icons: {
    icon: "/favicon.ico",
  },
};

const CormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant-garamond",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-lato",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <body
        className={clsx(
          "font-sans min-h-screen bg-[#f1f4f1] w-full overflow-x-hidden",
          CormorantGaramond.variable,
          lato.variable
        )}
      >
        <WagmiWrapper>
          <ScrollWrapper>{children}</ScrollWrapper>
        </WagmiWrapper>
      </body>
    </html>
  );
}
