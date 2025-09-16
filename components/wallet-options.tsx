import * as React from "react";
import { Connector, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, ExternalLink, Shield, Chrome } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "./glow-symbol";
import Image from "next/image";

export function WalletOptions() {
  const { connectors, connect, isPending, error, reset } = useConnect();

  // Filter out duplicate MetaMask connectors
  const uniqueConnectors = React.useMemo(() => {
    const seen = new Set<string>();
    const filtered = connectors.filter((connector) => {
      const name = connector.name.toLowerCase();

      // If it's a MetaMask-related connector, use a normalized key
      if (name.includes("metamask")) {
        if (seen.has("metamask")) {
          return false; // Skip duplicate
        }
        seen.add("metamask");
        return true;
      }

      // For other connectors, use the full name as the key
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });

    return filtered;
  }, [connectors]);

  // Debug connectors
  React.useEffect(() => {
    console.log(
      "Available connectors:",
      connectors.map((c) => ({
        name: c.name,
        uid: c.uid,
        type: c.type,
      }))
    );
    console.log(
      "Filtered connectors:",
      uniqueConnectors.map((c) => ({
        name: c.name,
        uid: c.uid,
        type: c.type,
      }))
    );
  }, [connectors, uniqueConnectors]);

  // Clear any existing connections before showing options
  React.useEffect(() => {
    if (error?.message.includes("already connected")) {
      console.log("Resetting due to already connected error");
      reset();
    }
  }, [error, reset]);

  const handleConnect = (connector: Connector) => {
    try {
      // Reset any previous errors
      reset();
      console.log("Attempting to connect with:", connector.name);
      connect({ connector });
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  return (
    <div className="px-8 py-12 max-h-[80vh] overflow-y-auto">
      <div className="text-center">
        {/* Header */}
        <div className="mb-6">
          <GlowSymbol className="size-16 mb-2 mx-auto" />
          <div className="text-4xl font-bold text-foreground mb-2">
            Connect wallet
          </div>
          <div className="text-muted-foreground text-sm">
            By connecting your wallet, you agree to Glow's{" "}
            <button className="text-primary hover:text-primary/80 underline">
              Terms
            </button>{" "}
            &{" "}
            <button className="text-primary hover:text-primary/80 underline">
              Privacy Policy
            </button>
          </div>
        </div>

        {error && !error.message.includes("already connected") && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-destructive">
              Connection failed: {error.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="mt-2 h-6 text-xs"
            >
              Try again
            </Button>
          </div>
        )}

        {/* Wallet Options */}
        <div className="space-y-3 mb-8">
          {uniqueConnectors.map((connector) => (
            <WalletOption
              key={connector.uid}
              connector={connector}
              onClick={() => handleConnect(connector)}
              isPending={isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WalletOption({
  connector,
  onClick,
  isPending,
}: {
  connector: Connector;
  onClick: () => void;
  isPending: boolean;
}) {
  const [ready, setReady] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const provider = await connector.getProvider();
        console.log(`${connector.name} provider check:`, !!provider);
        setReady(!!provider);
      } catch (err) {
        console.log(`${connector.name} provider check failed:`, err);
        // For some connectors, getProvider might fail but they're still usable
        // Set ready to true for injected and WalletConnect as they're usually available
        const isBasicConnector =
          connector.name.toLowerCase().includes("injected") ||
          connector.name.toLowerCase().includes("walletconnect");
        setReady(isBasicConnector);
      }
    })();
  }, [connector]);
  const getWalletIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("metamask")) {
      return "/images/icons/metamask.png";
    }
    if (lowerName.includes("walletconnect")) {
      return "/images/icons/wallet-connect.png";
    }
    if (lowerName.includes("coinbase")) {
      return "/images/icons/coinbase.png";
    }
    if (lowerName.includes("safe")) {
      return "/images/icons/safe.png";
    }
    return null; // Use fallback for unknown wallets
  };

  const getWalletDescription = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("metamask")) {
      return "Connect using MetaMask browser extension";
    }
    if (lowerName.includes("walletconnect")) {
      return "Scan with WalletConnect to connect";
    }
    if (lowerName.includes("coinbase")) {
      return "Connect using Coinbase Wallet";
    }
    if (lowerName.includes("safe")) {
      return "Connect to Safe multisig wallet";
    }
    if (lowerName.includes("injected")) {
      return "Connect using browser wallet";
    }
    return "Connect with this wallet";
  };

  const isDisabled = !ready || isPending;

  const handleClick = () => {
    console.log("Wallet option clicked:", {
      name: connector.name,
      ready,
      isPending,
      isDisabled,
    });
    if (!isDisabled) {
      onClick();
    }
  };

  return (
    <Button
      disabled={isDisabled}
      onClick={handleClick}
      variant="outline"
      className={cn(
        "w-full h-16 p-4 justify-start text-left transition-all duration-200",
        "hover:bg-muted hover:border-border/60 hover:text-foreground",
        "focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
        isHovered && !isDisabled && "bg-muted/30",
        isDisabled && "opacity-50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            isHovered && !isDisabled && "bg-muted/70"
          )}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-muted-foreground">
              {(() => {
                const iconPath = getWalletIcon(connector.name);
                return iconPath ? (
                  <Image
                    src={iconPath}
                    alt={`${connector.name} icon`}
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                ) : (
                  <GlowSymbol className="size-8" />
                );
              })()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{connector.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {getWalletDescription(connector.name)}
          </div>
        </div>

        {!ready && !isPending && (
          <div className="text-xs text-muted-foreground">Not detected</div>
        )}
      </div>
    </Button>
  );
}
