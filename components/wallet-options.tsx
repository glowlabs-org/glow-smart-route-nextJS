import * as React from "react";
import { Connector, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "./glow-symbol";
import Image from "next/image";
import {
  detectWallets,
  detectWalletFromProvider,
} from "@/lib/wallet-detection";

export function WalletOptions() {
  const { connectors, connect, isPending, error, reset } = useConnect();

  const uniqueConnectors = React.useMemo(() => {
    const detectedWallets = detectWallets();
    const deduplicated = new Map<string, Connector>();
    const hasMetaMaskDetected = detectedWallets.some((w) => w.isMetaMask);
    const hasMetaMaskConnector = connectors.some(
      (c) =>
        c.id === "io.metamask" ||
        c.id.toLowerCase() === "metamask" ||
        c.name.toLowerCase().includes("metamask")
    );
    const hasCoinbaseConnector = connectors.some(
      (c) =>
        c.id.includes("coinbase") || c.name.toLowerCase().includes("coinbase")
    );

    connectors.forEach((connector) => {
      const name = connector.name.toLowerCase();
      const id = connector.id.toLowerCase();

      let key: string = `${id}-${name}`;
      let shouldSkip = false;

      if (
        id === "metamask" ||
        name.includes("metamask") ||
        id === "io.metamask"
      ) {
        key = "metamask";
      } else if (
        name.includes("walletconnect") ||
        id.includes("walletconnect")
      ) {
        key = "walletconnect";
      } else if (name.includes("coinbase") || id.includes("coinbase")) {
        key = "coinbase";
      } else if (name.includes("injected") || id.includes("injected")) {
        const ethereum =
          typeof window !== "undefined" ? (window as any).ethereum : null;

        if (!ethereum) {
          key = `injected-${connector.uid}`;
        } else {
          // The injected connector connects to window.ethereum directly
          // Check window.ethereum itself first (it might be MetaMask, Phantom, etc.)
          // If it's a wrapper with providers array, check if window.ethereum has wallet flags
          let targetProvider: any = ethereum;

          // If window.ethereum doesn't have wallet flags but has providers array,
          // check the first provider (but note: injected connector still connects to window.ethereum)
          if (
            !ethereum.isMetaMask &&
            !ethereum.isPhantom &&
            !ethereum.isTrust &&
            !ethereum.isTrustWallet &&
            !ethereum.isCoinbaseWallet &&
            !ethereum.isBase &&
            Array.isArray(ethereum.providers) &&
            ethereum.providers.length > 0
          ) {
            // window.ethereum is likely a wrapper, but injected connector connects to it
            // We'll check providers[0] to determine which wallet it might route to
            targetProvider = ethereum.providers[0];
          }

          // Check what the injected connector will actually connect to
          // If window.ethereum itself is MetaMask, skip injected connector when we have metaMask connector
          if (ethereum.isMetaMask || targetProvider?.isMetaMask) {
            if (hasMetaMaskConnector) {
              shouldSkip = true;
            } else {
              key = "metamask-injected";
            }
          } else if (
            ethereum.isCoinbaseWallet ||
            targetProvider?.isCoinbaseWallet
          ) {
            if (hasCoinbaseConnector) {
              shouldSkip = true;
            } else {
              key = "coinbase-injected";
            }
          } else if (
            ethereum.isTrust ||
            ethereum.isTrustWallet ||
            targetProvider?.isTrust ||
            targetProvider?.isTrustWallet
          ) {
            key = "trust-injected";
          } else if (ethereum.isPhantom || targetProvider?.isPhantom) {
            key = "phantom-injected";
          } else if (ethereum.isBase || targetProvider?.isBase) {
            key = "base-injected";
          } else {
            key = `injected-${connector.uid}`;
          }
        }
      }

      if (shouldSkip) {
        return;
      }

      if (!deduplicated.has(key)) {
        deduplicated.set(key, connector);
      } else if (id === "metamask" || id === "io.metamask") {
        deduplicated.set(key, connector);
      }
    });

    return Array.from(deduplicated.values());
  }, [connectors]);

  const hasTrustWallet = React.useMemo(() => {
    return uniqueConnectors.some(
      (connector) =>
        connector.name.toLowerCase().includes("trust") ||
        connector.id.toLowerCase().includes("trust")
    );
  }, [uniqueConnectors]);

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

        {hasTrustWallet && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              ⚠️ Trust Wallet is not well supported. For the best experience,
              please use MetaMask or Coinbase Wallet.
            </p>
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
  const [detectedWallet, setDetectedWallet] = React.useState<ReturnType<
    typeof detectWalletFromProvider
  > | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const provider = await connector.getProvider();
        setReady(!!provider);
        if (provider) {
          const detected = detectWalletFromProvider(provider);
          setDetectedWallet(detected);
        }
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

  const getWalletIcon = (name: string, detected: typeof detectedWallet) => {
    const lowerName = name.toLowerCase();

    if (detected) {
      if (detected.isRabby) return null;
      if (detected.isMetaMask) return "/images/icons/metamask.png";
      if (detected.isPhantom) return null;
      if (detected.isTrustWallet) return null;
      if (detected.isBase) return "/images/icons/base.png";
      if (detected.isCoinbase) return "/images/icons/coinbase.png";
    }

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
      if (detected?.isMetaMask) {
        return "/images/icons/metamask.png";
      }
      if (detected?.isBase) {
        return "/images/icons/base.png";
      }
    }
    return null;
  };

  const getWalletDescription = (
    name: string,
    detected: typeof detectedWallet
  ) => {
    const lowerName = name.toLowerCase();

    if (detected) {
      if (detected.isTrustWallet) {
        return "Not well supported - use another wallet for best experience";
      }
      if (detected.isRabby) {
        return "Connect using Rabby browser extension";
      }
      if (detected.isMetaMask) {
        return "Connect using MetaMask browser extension";
      }
      if (detected.isPhantom) {
        return "Connect using Phantom wallet";
      }
      if (detected.isCoinbase) {
        return "Connect using Coinbase Wallet";
      }
      if (detected.isBase) {
        return "Connect using Base Wallet";
      }
      return `Connect using ${detected.name}`;
    }

    if (lowerName.includes("trust")) {
      return "Not well supported - use another wallet for best experience";
    }
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
      return "Connect using browser wallet";
    }
    return "Connect with this wallet";
  };

  const getWalletLabel = (name: string, detected: typeof detectedWallet) => {
    const lowerName = name.toLowerCase();

    if (detected) {
      return detected.name;
    }

    if (lowerName.includes("injected")) {
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
                const iconPath = getWalletIcon(connector.name, detectedWallet);
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
            {getWalletLabel(connector.name, detectedWallet)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {getWalletDescription(connector.name, detectedWallet)}
          </div>
        </div>

        {!ready && !isPending && (
          <div className="text-xs text-muted-foreground">Not detected</div>
        )}
      </div>
    </Button>
  );
}
