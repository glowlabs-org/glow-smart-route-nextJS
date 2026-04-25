// Currently shipped languages. Adding a new one: append the code here, add an
// entry to LANGUAGE_META, and add the matching block in every namespace file.
// See docs/TRANSLATION.md for the full checklist.
export const SUPPORTED_LANGS = ["en", "ko"] as const;

export type Lang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

export const LANG_STORAGE_KEY = "glow-lang";
// Prior key used only by the ambassador dashboard. Read once on first load so
// users who set Korean there don't flip back to English after this refactor.
export const LEGACY_LANG_STORAGE_KEY = "ambassador-dashboard-lang";

export interface LanguageMeta {
  label: string;
  flag: string;
  bcp47: string;
}

export const LANGUAGE_META: Record<Lang, LanguageMeta> = {
  en: { label: "English", flag: "\u{1F1FA}\u{1F1F8}", bcp47: "en-US" },
  ko: { label: "한국어", flag: "\u{1F1F0}\u{1F1F7}", bcp47: "ko-KR" },
};

export function isLang(value: unknown): value is Lang {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGS as readonly string[]).includes(value)
  );
}

export function getBcp47(lang: Lang): string {
  return LANGUAGE_META[lang].bcp47;
}
