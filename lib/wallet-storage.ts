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
};

const SUPPORTED_RECENT_CONNECTOR_IDS = new Set([
  "io.metamask",
  "com.coinbase.wallet",
  "com.trustwallet.app",
  "io.rabby",
  "com.ledger.live",
  "injected",
  "walletConnect",
]);

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

function hasWalletConnectSession(storage: KeyedStorage) {
  for (let i = 0; i < storage.length; i += 1) {
    const storageKey = storage.key(i);
    if (!storageKey) continue;

    const lower = storageKey.toLowerCase();
    const isWalletConnectKey =
      lower.startsWith("wc@2") ||
      lower.startsWith("wc@") ||
      lower.includes("walletconnect");
    if (!isWalletConnectKey) continue;

    const value = storage.getItem(storageKey);
    if (value && value !== "null" && value !== "undefined") return true;
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

  if (!SUPPORTED_RECENT_CONNECTOR_IDS.has(value)) {
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // Ignore storage access errors.
    }
    removeCookie(key);
    return null;
  }

  if (value !== "walletConnect") return value;
  if (storage && hasWalletConnectSession(storage)) return value;

  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
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
