"use client";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type WalletStorage = {
  getItem: (key: string) => string | null | undefined;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type KeyedStorage = {
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  length: number;
  removeItem?: (key: string) => void;
};

const SUPPORTED_RECENT_CONNECTOR_IDS = new Set([
  "metaMask",
  "coinbaseWallet",
  "phantom",
  "io.metamask",
  "com.coinbase.wallet",
  "app.phantom",
  "com.trustwallet.app",
  "io.rabby",
  "com.ledger.live",
  "injected",
  "walletConnect",
]);

function normalizeRecentConnectorId(value: string) {
  if (value === "metaMask") return "io.metamask";
  if (value === "coinbaseWallet") return "com.coinbase.wallet";
  if (value === "phantom") return "app.phantom";
  return value;
}

function parseRecentConnectorId(
  value: string,
): { connectorId: string; isSerialized: boolean } {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") {
      return { connectorId: parsed, isSerialized: true };
    }
  } catch {
    // Fallback to plain string value.
  }

  return { connectorId: value, isSerialized: false };
}

function formatRecentConnectorId(value: string, isSerialized: boolean) {
  return isSerialized ? JSON.stringify(value) : value;
}

function getSecureCookieSuffix() {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function removeCookie(key: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${getSecureCookieSuffix()}`;
}

function isWalletConnectStorageKey(storageKey: string) {
  const lower = storageKey.toLowerCase();
  return (
    lower.startsWith("wc@2") ||
    lower.startsWith("wc@") ||
    lower.includes("walletconnect")
  );
}

function collectHexTopics(value: string) {
  const matches = value.match(/[a-f0-9]{64}/gi);
  if (!matches) return [];
  return matches.map((match) => match.toLowerCase());
}

function removeWalletConnectArtifacts(storage: KeyedStorage) {
  if (typeof storage.removeItem !== "function") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const storageKey = storage.key(i);
    if (!storageKey) continue;
    if (!isWalletConnectStorageKey(storageKey)) continue;
    keysToRemove.push(storageKey);
  }

  keysToRemove.forEach((storageKey) => {
    try {
      storage.removeItem?.(storageKey);
    } catch {
      // Ignore storage access errors.
    }
    removeCookie(storageKey);
  });
}

function hasWalletConnectSession(storage: KeyedStorage) {
  const sessionTopics = new Set<string>();
  const keychainTopics = new Set<string>();
  let sawWalletConnectEntry = false;

  for (let i = 0; i < storage.length; i += 1) {
    const storageKey = storage.key(i);
    if (!storageKey) continue;
    if (!isWalletConnectStorageKey(storageKey)) continue;
    sawWalletConnectEntry = true;

    const value = storage.getItem(storageKey);
    if (!value || value === "null" || value === "undefined") continue;

    const lowerKey = storageKey.toLowerCase();
    const topics = collectHexTopics(value);

    if (lowerKey.includes("session")) {
      topics.forEach((topic) => sessionTopics.add(topic));
    }
    if (lowerKey.includes("keychain")) {
      topics.forEach((topic) => keychainTopics.add(topic));
    }
  }

  if (!sawWalletConnectEntry) return false;
  if (sessionTopics.size === 0 || keychainTopics.size === 0) return false;

  for (const topic of sessionTopics) {
    if (keychainTopics.has(topic)) return true;
  }

  return false;
}

function sanitizeRecentConnectorId(
  key: string,
  value: string | null | undefined,
  storage?: KeyedStorage
) {
  if (!value) return value ?? null;
  if (key !== "wagmi.recentConnectorId") return value;
  const { connectorId, isSerialized } = parseRecentConnectorId(value);
  const normalizedValue = normalizeRecentConnectorId(connectorId);

  if (!SUPPORTED_RECENT_CONNECTOR_IDS.has(normalizedValue)) {
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // Ignore storage access errors.
    }
    removeCookie(key);
    return null;
  }

  if (normalizedValue !== "walletConnect") {
    if (storage) removeWalletConnectArtifacts(storage);
    return formatRecentConnectorId(normalizedValue, isSerialized);
  }
  if (storage && hasWalletConnectSession(storage)) {
    return formatRecentConnectorId(normalizedValue, isSerialized);
  }
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
  if (storage) removeWalletConnectArtifacts(storage);
  removeCookie(key);
  return null;
}

export function getCookieValue(
  key: string,
  cookieString?: string | null
): string | null {
  const source =
    cookieString ?? (typeof document !== "undefined" ? document.cookie : null);
  if (!source) return null;

  const entries = source.split(";");
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    if (name !== key) continue;

    const rawValue = trimmed.slice(separatorIndex + 1);
    return decodeCookieValue(rawValue);
  }

  return null;
}

export function createPersistentWalletStorage(): WalletStorage {
  return {
    getItem(key) {
      if (typeof window === "undefined") return null;

      try {
        const localStorage = window.localStorage as KeyedStorage | undefined;
        const localValue = localStorage?.getItem(key);
        if (localValue != null) {
          return sanitizeRecentConnectorId(key, localValue, localStorage);
        }
      } catch {
        // Ignore storage access errors (e.g. private mode restrictions).
      }

      return sanitizeRecentConnectorId(key, getCookieValue(key));
    },
    setItem(key, value) {
      if (typeof window === "undefined") return;

      try {
        window.localStorage?.setItem(key, value);
      } catch {
        // Ignore storage access errors (e.g. private mode restrictions).
      }

      if (typeof document === "undefined") return;

      const encodedValue = encodeURIComponent(value);
      document.cookie = `${key}=${encodedValue}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${getSecureCookieSuffix()}`;
    },
    removeItem(key) {
      if (typeof window === "undefined") return;

      try {
        window.localStorage?.removeItem(key);
      } catch {
        // Ignore storage access errors (e.g. private mode restrictions).
      }

      removeCookie(key);
    },
  };
}
