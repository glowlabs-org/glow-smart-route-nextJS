import { createStorage } from "wagmi";
import { createPersistentWalletStorage } from "../lib/wallet-storage";

type MockStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  key: (index: number) => string | null;
  length: number;
};

function createMockLocalStorage(): MockStorage {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(String(key), String(value));
    },
    removeItem(key: string) {
      values.delete(String(key));
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  };
}

function createMockDocument(initialCookies: Record<string, string> = {}) {
  const cookies = new Map<string, string>(Object.entries(initialCookies));

  return {
    get cookie() {
      return Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
    set cookie(rawCookie: string) {
      const [pair, ...attributes] = rawCookie
        .split(";")
        .map((part) => part.trim());
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 0) return;

      const name = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      const maxAgeAttribute = attributes.find((attribute) =>
        attribute.toLowerCase().startsWith("max-age=")
      );

      if (maxAgeAttribute) {
        const parsedMaxAge = Number(maxAgeAttribute.slice("max-age=".length));
        if (!Number.isNaN(parsedMaxAge) && parsedMaxAge <= 0) {
          cookies.delete(name);
          return;
        }
      }

      cookies.set(name, value);
    },
  };
}

describe("wallet storage + wagmi integration", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        location: { protocol: "https:" },
        localStorage: createMockLocalStorage(),
      },
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: createMockDocument(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: originalDocument,
    });
  });

  it("persists reconnect target via recentConnectorId", async () => {
    const storage = createStorage({ storage: createPersistentWalletStorage() });

    await storage.setItem("recentConnectorId", "io.metamask");

    expect(await storage.getItem("recentConnectorId")).toBe("io.metamask");
    expect(document.cookie.includes("wagmi.recentConnectorId=")).toBe(true);
  });

  it("round-trips wagmi state required for reconnect hydration", async () => {
    const storage = createStorage({ storage: createPersistentWalletStorage() });

    const state = {
      chainId: 1,
      current: "connector-uid",
      connections: new Map([
        [
          "connector-uid",
          {
            accounts: ["0x0000000000000000000000000000000000000000"],
            chainId: 1,
            connector: {
              id: "walletConnect",
              name: "WalletConnect",
              type: "walletConnect",
              uid: "connector-uid",
            },
          },
        ],
      ]),
    };

    await storage.setItem("state", state as any);

    const restored = await storage.getItem("state");

    expect(restored?.current).toBe("connector-uid");
    expect(restored?.chainId).toBe(1);
    expect(restored?.connections instanceof Map).toBe(true);
    expect(restored?.connections.get("connector-uid")?.connector.id).toBe(
      "walletConnect"
    );
  });
});
