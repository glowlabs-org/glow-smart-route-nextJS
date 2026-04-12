import {
  createPersistentWalletStorage,
  getCookieValue,
} from "../lib/wallet-storage";

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
      const [pair, ...attributes] = rawCookie.split(";").map((part) => part.trim());
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

describe("wallet storage", () => {
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

  it("reads encoded cookies with and without whitespace separators", () => {
    const encoded = encodeURIComponent('{"state":{"current":"connector"}}');

    expect(getCookieValue("wagmi.store", `foo=bar;wagmi.store=${encoded}`)).toBe(
      '{"state":{"current":"connector"}}'
    );

    expect(getCookieValue("wagmi.store", `foo=bar; wagmi.store=${encoded}`)).toBe(
      '{"state":{"current":"connector"}}'
    );
  });

  it("writes to both localStorage and cookies", () => {
    const storage = createPersistentWalletStorage();

    storage.setItem("wagmi.recentConnectorId", "io.metamask");

    expect(window.localStorage.getItem("wagmi.recentConnectorId")).toBe("io.metamask");
    expect(getCookieValue("wagmi.recentConnectorId", document.cookie)).toBe("io.metamask");
  });

  it("prefers localStorage over cookie when both are present", () => {
    const storage = createPersistentWalletStorage();

    window.localStorage.setItem("wagmi.store", "local-value");
    document.cookie = `wagmi.store=${encodeURIComponent("cookie-value")}; Path=/; Max-Age=2592000; SameSite=Lax`;

    expect(storage.getItem("wagmi.store")).toBe("local-value");
  });

  it("falls back to cookies when localStorage has no value", () => {
    const storage = createPersistentWalletStorage();

    document.cookie = `wagmi.store=${encodeURIComponent("cookie-value")}; Path=/; Max-Age=2592000; SameSite=Lax`;

    expect(storage.getItem("wagmi.store")).toBe("cookie-value");
  });

  it("removes both localStorage and cookie entries", () => {
    const storage = createPersistentWalletStorage();

    storage.setItem("wagmi.recentConnectorId", "walletConnect");
    storage.removeItem("wagmi.recentConnectorId");

    expect(window.localStorage.getItem("wagmi.recentConnectorId")).toBeNull();
    expect(getCookieValue("wagmi.recentConnectorId", document.cookie)).toBeNull();
  });

  it("drops stale walletConnect recent connector id when no WC session exists", () => {
    const storage = createPersistentWalletStorage();

    window.localStorage.setItem("wagmi.recentConnectorId", "walletConnect");

    expect(storage.getItem("wagmi.recentConnectorId")).toBeNull();
    expect(window.localStorage.getItem("wagmi.recentConnectorId")).toBeNull();
  });

  it("keeps walletConnect recent connector id when a WC session exists", () => {
    const storage = createPersistentWalletStorage();
    const topic = "a".repeat(64);

    window.localStorage.setItem("wagmi.recentConnectorId", "walletConnect");
    window.localStorage.setItem(
      "wc@2:client:0.3//session",
      JSON.stringify({ [topic]: { topic } })
    );
    window.localStorage.setItem(
      "wc@2:core:0.3//keychain",
      JSON.stringify({ [topic]: "symKey" })
    );

    expect(storage.getItem("wagmi.recentConnectorId")).toBe("walletConnect");
  });

  it("purges stale walletConnect artifacts when non-WC connector is selected", () => {
    const storage = createPersistentWalletStorage();
    const topic = "b".repeat(64);

    window.localStorage.setItem("wagmi.recentConnectorId", "io.metamask");
    window.localStorage.setItem(
      "wc@2:client:0.3//session",
      JSON.stringify({ [topic]: { topic } })
    );
    window.localStorage.setItem(
      "wc@2:core:0.3//keychain",
      JSON.stringify({ [topic]: "symKey" })
    );

    expect(storage.getItem("wagmi.recentConnectorId")).toBe("io.metamask");
    expect(window.localStorage.getItem("wc@2:client:0.3//session")).toBeNull();
    expect(window.localStorage.getItem("wc@2:core:0.3//keychain")).toBeNull();
  });

  it("normalizes legacy Coinbase and Phantom recent connector ids", () => {
    const storage = createPersistentWalletStorage();

    window.localStorage.setItem("wagmi.recentConnectorId", "coinbaseWallet");
    expect(storage.getItem("wagmi.recentConnectorId")).toBe(
      "com.coinbase.wallet"
    );

    window.localStorage.setItem("wagmi.recentConnectorId", "phantom");
    expect(storage.getItem("wagmi.recentConnectorId")).toBe("app.phantom");
  });
});
