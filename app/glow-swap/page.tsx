import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import View from "../buy/view";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";
import { Error } from "@/components/loading";
import { PageWrapper } from "../components/page-wrapper";
import { Metadata } from "next";
import { Header } from "@/components/header";

export const revalidate = 36;

export const metadata: Metadata = {
  title: "Token Exchange - Swap GLOW, USDG, USDC & Provide Liquidity",
  description:
    "Trade and swap Glow tokens. Buy GLOW with USDG or USDC, provide liquidity to the GLOW/USDG Uniswap pool, and participate in the Glow ecosystem's guarded launch.",
  keywords: [
    "Glow token",
    "GLOW",
    "USDG",
    "USDC",
    "DeFi",
    "token swap",
    "decentralized exchange",
    "liquidity provision",
    "liquidity pool",
    "yield farming",
    "Ethereum",
    "blockchain",
    "cryptocurrency",
    "Uniswap",
    "guarded launch",
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
    canonical: "/glow-swap",
  },
  openGraph: {
    title: "Token Exchange - Swap GLOW, USDG, USDC & Provide Liquidity",
    description:
      "Trade and swap Glow tokens. Buy GLOW with USDG or USDC, provide liquidity to the GLOW/USDG Uniswap pool, and participate in the Glow ecosystem's guarded launch.",
    url: "https://app.glow.org/glow-swap",
    siteName: "app.glow.org",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glow Token Exchange - Swap GLOW, USDG, USDC & Provide Liquidity",
    description:
      "Trade and swap Glow tokens on the decentralized exchange. Buy GLOW with USDG or USDC, provide liquidity to earn rewards, and participate in the Glow ecosystem's guarded launch.",
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

interface PageContentProps {
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
}

function PageContent(props: PageContentProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <View
        glowPrice={props.glowPrice}
        earlyLiquidityCurrentPrice={props.earlyLiquidityCurrentPrice}
        marketCap={props.marketCap}
        ethPriceInUSD={props.ethPriceInUSD}
        usdcRewardPool={props.usdcRewardPool}
      />
    </div>
  );
}

export default async function TokenPage() {
  try {
    const [glowStats, ethPriceInUSD] = await Promise.all([
      getHeadlineStats(),
      getEthPriceInUSD(),
    ]);

    const glowPrice = glowStats.lowestGlowPrice.toString();
    const earlyLiquidityCurrentPrice = glowStats.earlyLiquidityPrice.toString();
    const marketCap = glowStats.marketCap.toString();
    const usdcRewardPool = glowStats.usdcRewardPool;

    return (
      <PageWrapper>
        <PageContent
          glowPrice={glowPrice}
          earlyLiquidityCurrentPrice={earlyLiquidityCurrentPrice}
          marketCap={marketCap}
          ethPriceInUSD={ethPriceInUSD}
          usdcRewardPool={usdcRewardPool}
        />
      </PageWrapper>
    );
  } catch (error) {
    console.error("Error fetching data:", error);
    return (
      <Error message="Failed to load market data. Please check your connection and try again." />
    );
  }
}
