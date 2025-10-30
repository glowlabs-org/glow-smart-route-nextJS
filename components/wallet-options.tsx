import * as React from "react";
import { Connector, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "./glow-symbol";
import Image from "next/image";

export function WalletOptions() {
  const { connectors, connect, isPending, error, reset } = useConnect();

  const uniqueConnectors = React.useMemo(() => {
    const isMetaMaskInstalled =
      typeof window !== "undefined" && window.ethereum?.isMetaMask;

    const deduplicated = new Map<string, Connector>();

    connectors.forEach((connector) => {
      const name = connector.name.toLowerCase();
      const id = connector.id.toLowerCase();

      // Skip the specific MetaMask connector if MetaMask is already installed
      if (isMetaMaskInstalled && id === "metamask") {
        return;
      }

      // For MetaMask-like connectors, use a unified key
      let key = name;
      if (name.includes("metamask") || id.includes("metamask")) {
        key = "metamask";
      } else if (name.includes("injected") && isMetaMaskInstalled) {
        key = "metamask"; // Group injected with MetaMask when MM is installed
      }

      // Only keep the first occurrence of each key
      if (!deduplicated.has(key)) {
        deduplicated.set(key, connector);
      }
    });

    const result = Array.from(deduplicated.values());
    return result;
  }, [connectors]);

  React.useEffect(() => {
    if (error?.message.includes("already connected")) {
      reset();
    }
  }, [error, reset]);

  const handleConnect = async (connector: Connector) => {
    try {
      reset();

      if (typeof window !== "undefined" && window.ethereum?.selectedAddress) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      connect({ connector });
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  return (
    <div className="px-8 py-12 max-h-[80vh] overflow-y-auto">
      <div className="text-center">
        <div className="mb-6">
          <GlowSymbol className="size-16 mb-2 mx-auto" />
          <div className="text-2xl md:text-4xl font-bold text-foreground mb-2">
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
        setReady(!!provider);
      } catch (err) {
        console.error(`${connector.name} provider check failed:`, err);
        const lowerName = connector.name.toLowerCase();
        const isBasicConnector =
          lowerName.includes("injected") ||
          lowerName.includes("walletconnect") ||
          lowerName.includes("base") ||
          lowerName.includes("browser");
        setReady(isBasicConnector);
      }
    })();
  }, [connector]);
  const getWalletIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    const isMetaMaskInstalled =
      typeof window !== "undefined" && window.ethereum?.isMetaMask;
    const isBaseWalletApp =
      typeof window !== "undefined" && window.ethereum?.isBase;

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
    if (lowerName.includes("base") && !lowerName.includes("coinbase")) {
      return "/images/icons/base.png";
    }
    if (lowerName.includes("injected")) {
      if (isMetaMaskInstalled) {
        return "/images/icons/metamask.png";
      }
      if (isBaseWalletApp) {
        return "/images/icons/base.png";
      }
    }
    return null;
  };

  const getWalletDescription = (name: string) => {
    const lowerName = name.toLowerCase();
    const isMetaMaskInstalled =
      typeof window !== "undefined" && window.ethereum?.isMetaMask;
    const isBaseWalletApp =
      typeof window !== "undefined" && window.ethereum?.isBase;

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
    if (lowerName.includes("base") && !lowerName.includes("coinbase")) {
      return "Connect using Base Wallet";
    }
    if (lowerName.includes("injected")) {
      if (isMetaMaskInstalled) {
        return "Connect using MetaMask browser extension";
      }
      if (isBaseWalletApp) {
        return "Connect using Base Wallet app";
      }
      return "Connect using browser wallet";
    }
    return "Connect with this wallet";
  };

  const getWalletLabel = (name: string) => {
    const lowerName = name.toLowerCase();

    const isMetaMaskInstalled =
      typeof window !== "undefined" && window.ethereum?.isMetaMask;
    const isBaseWalletApp =
      typeof window !== "undefined" && window.ethereum?.isBase;

    if (lowerName.includes("injected")) {
      if (isMetaMaskInstalled) {
        return "MetaMask";
      }
      if (isBaseWalletApp) {
        return "Base Wallet";
      }
      return "Browser Wallet";
    }

    if (lowerName.includes("base") && !lowerName.includes("coinbase")) {
      return "Base Wallet";
    }

    return name;
  };

  const isDisabled = !ready || isPending;

  const handleClick = () => {
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
          <div className="font-medium text-sm">
            {getWalletLabel(connector.name)}
          </div>
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
