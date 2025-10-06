"use client";

import View from "@/app/wallet/view";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";

export default function Page() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);

  // Handle mounting and give wagmi time to initialize
  useEffect(() => {
    setIsMounted(true);

    // Small delay to allow wagmi to check for stored connections and start reconnecting
    const timer = setTimeout(() => {
      setShowConnectPrompt(true);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // If not mounted yet, show nothing to prevent flash
  if (!isMounted) {
    return null;
  }

  // Show connect prompt only if:
  // 1. Enough time has passed (showConnectPrompt is true)
  // 2. Not connected
  // 3. Not connecting
  // 4. Not reconnecting
  const shouldShowConnectPrompt =
    showConnectPrompt && !isConnected && !isConnecting && !isReconnecting;

  if (shouldShowConnectPrompt) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-6 md:py-8 pt-20 md:pt-24">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center space-y-4 pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  Connect Your Wallet
                </CardTitle>
                <p className="text-muted-foreground text-base">
                  Please connect your wallet to view your Power Wallet
                </p>
              </CardHeader>
              <CardContent className="pb-6">
                <ConnectButton variant="default" size="large" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show the full wallet view when connected, connecting, or reconnecting
  return <View />;
}
