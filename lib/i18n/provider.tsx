"use client";

import * as React from "react";
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  LEGACY_LANG_STORAGE_KEY,
  isLang,
  type Lang,
} from "./config";
import { TRANSLATIONS, type Strings } from "./translations";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Strings;
}

const LangContext = React.createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: TRANSLATIONS[DEFAULT_LANG],
});

// Mirror lang to a cookie so lib/telemetry.ts can stamp it on every event
// (cookies are readable by both client + server, unlike localStorage).
const LANG_COOKIE = "glow_lang";
const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeLangCookie(value: Lang) {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${LANG_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(DEFAULT_LANG);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) {
      setLangState(stored);
      writeLangCookie(stored);
      return;
    }
    // One-time migration from the old ambassador-only key so existing Korean
    // users aren't flipped back to English after rollout.
    const legacy = window.localStorage.getItem(LEGACY_LANG_STORAGE_KEY);
    if (isLang(legacy)) {
      setLangState(legacy);
      window.localStorage.setItem(LANG_STORAGE_KEY, legacy);
      writeLangCookie(legacy);
      return;
    }
    // No stored preference yet: persist the default so server-side handlers
    // and analytics can read it consistently.
    writeLangCookie(DEFAULT_LANG);
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang === "ko" ? "ko-KR" : "en-US";
  }, [lang]);

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
      writeLangCookie(next);
    }
  }, []);

  const value = React.useMemo<LangContextValue>(
    () => ({ lang, setLang, t: TRANSLATIONS[lang] }),
    [lang, setLang],
  );

  return (
    <LangContext.Provider value={value}>{children}</LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return React.useContext(LangContext);
}
