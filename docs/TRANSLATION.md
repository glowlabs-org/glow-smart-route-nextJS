# Translation Guide — app.glow.org

This is the end-to-end guide for translating or updating copy in app.glow.org. Written for someone new to the codebase, whether you're a translator, a PM, or a new engineer picking this up.

**Currently shipped:** English (EN) and Korean (KO).
**Default language:** English.
**Language picker:** top-right of the header on every page.

---

## 1. Where translations live

Everything related to i18n is under `lib/i18n/`:

```
lib/i18n/
├── config.ts              Supported languages + metadata (label, flag, locale)
├── index.ts               Public barrel (LangProvider, useLang, types)
├── provider.tsx           React context + hook + localStorage persistence
├── translations.ts        Composes all namespaces into one TRANSLATIONS object
└── namespaces/
    ├── common.ts          Shared UI (language switcher, countdown labels)
    ├── ambassador.ts      /ambassador page
    ├── header.ts          Global nav (desktop + mobile drawer)
    ├── home.ts            / landing section headers + toasts + connecting state
    ├── tos.ts             Terms of Service dialog chrome
    ├── wallet.ts          Connect button, WalletStatus, network switcher
    └── widgets.ts         Home-page dashboard widgets
```

Each namespace file has the same shape:

```ts
// 1. Interface declaring every key that must exist per language.
export interface XxxStrings { ... }

// 2. English authoring copy. This is the source of truth.
const en: XxxStrings = { ... };

// 3. Korean translation.
const ko: XxxStrings = { ... };

// 4. Exported record keyed by language.
export const xxxTranslations: Record<Lang, XxxStrings> = { en, ko };
```

**TypeScript enforces that every language has every key** — if you add a key to `en` and forget it in `ko`, the build will fail.

---

## 2. Everyday task: update an existing string

Say the marketing team changed "Buy GLW" to "Get GLW".

1. Open the relevant namespace file. If you don't know which one, search the codebase for the current English copy: `grep -r "Buy GLW" lib/i18n/namespaces/`.
2. Update both `en` and `ko` entries:
   ```ts
   const en: WidgetStrings = { ...,  onboardingHero: { ..., buyGlw: "Get GLW" } };
   const ko: WidgetStrings = { ...,  onboardingHero: { ..., buyGlw: "GLW 받기" } };
   ```
3. Save. The change is live on next page load.

Verify locally:
```bash
pnpm dev
# then open http://localhost:3000 and use the language picker to check both langs
```

---

## 3. Everyday task: improve an existing Korean translation

Same flow as above but only edit the `ko` block. English copy is the source of truth, so leave it alone unless you also want to change the English wording.

If you're a non-engineer translator: you only need to edit the `ko: XxxStrings = { ... }` block. Don't touch the surrounding TypeScript.

---

## 4. Structure patterns you'll see

Most keys are plain strings. A few patterns show up often:

### Template functions
When a string has dynamic values, we use a function instead of placeholders so ordering can change per language:

```ts
// Interface
weekRangeHint: (start: number, end: number) => string;

// English
weekRangeHint: (start, end) => `Week ${start} - ${end}`,

// Korean (word order + counter word)
weekRangeHint: (start, end) => `${start}주 - ${end}주`,
```

### Prefix / suffix pairs
When a translated sentence wraps a styled element (a `<span>`, a formatted wallet address, etc.), we split into pre/post strings:

```ts
// Rendered in JSX as: `{pre}<span>{walletAddress}</span>{post}`
accessDeniedPrefix: "The connected wallet ",
accessDeniedSuffix: " is not registered as an ambassador...",
```

In Korean, the prefix/suffix split often needs to move the highlighted element — the JSX structure lets you do this by changing the pre/post copy.

### Structured content (FAQ, bullet lists)
The Glow FAQ widget uses typed data instead of inline JSX so translators don't have to touch `<strong>`/`<ul>`/`<li>`:

```ts
items: [
  {
    id: "item-2",
    q: "What is GLW and why does it matter?",
    paragraphs: ["GLW is the utility token..."],
    bullets: [
      { label: "Incentive:", text: "Solar farms earn GLW..." },
      { label: "Governance:", text: "It is used to vote..." },
    ],
  },
  // ...
]
```

The widget renders paragraphs → bullets → callout in that order. To change the visual structure you need to edit the widget; to change the copy you only touch this data.

---

## 5. Task: translate a new page or component

You want to translate a page that still has hardcoded English.

1. **Find the strings.** Open the component and look for any text inside JSX, `aria-label`, `title=`, `placeholder=`, `toast.success(...)` calls, etc.
2. **Pick or create a namespace.** If it's a new feature (e.g. `/buy`), create `lib/i18n/namespaces/buy.ts`. If it extends an existing surface (e.g. a new widget), add a sub-object to `widgets.ts`.
3. **Define the interface and English values** following the pattern above.
4. **Add the namespace to `translations.ts`:**
   ```ts
   import { buyTranslations, type BuyStrings } from "./namespaces/buy";

   export interface Strings {
     // ...
     buy: BuyStrings;
   }

   // and inside the reduce:
   buy: buyTranslations[lang],
   ```
5. **Swap the component:**
   ```tsx
   import { useLang } from "@/lib/i18n";

   export function BuyPage() {
     const { t } = useLang();
     return <h1>{t.buy.pageTitle}</h1>;
   }
   ```
6. **Add Korean translations** to the `ko` block of the new namespace.
7. **Verify types:** `pnpm exec tsc --noEmit`.
8. **Verify visually:** `pnpm dev`, toggle to Korean, click through the page.

---

## 6. Task: add a new language (Spanish, Chinese, Japanese, etc.)

Five steps:

1. **Register the code** in `lib/i18n/config.ts`:
   ```ts
   export const SUPPORTED_LANGS = ["en", "ko", "es"] as const; // added "es"

   export const LANGUAGE_META: Record<Lang, LanguageMeta> = {
     en: { label: "English", flag: "🇺🇸", bcp47: "en-US" },
     ko: { label: "한국어", flag: "🇰🇷", bcp47: "ko-KR" },
     es: { label: "Español", flag: "🇪🇸", bcp47: "es-ES" },
   };
   ```
2. **TypeScript will now error on every namespace file** because the `Record<Lang, …>` maps are missing the new language. Open each namespace file in `lib/i18n/namespaces/` (currently: `common`, `ambassador`, `header`, `home`, `tos`, `wallet`, `widgets`) and add an `es` block right after the `ko` block. Start with a copy of `en` and translate as you go — this lets you ship incrementally without blocking the build:
   ```ts
   // TODO(i18n/es): translation in progress; untouched keys fall back to English copy.
   const es: XxxStrings = { ...en };

   export const xxxTranslations: Record<Lang, XxxStrings> = { en, ko, es };
   ```
3. **Override keys as you translate them.** e.g. `const es: XxxStrings = { ...en, pageTitle: "Panel" };`. Keys you haven't touched will render in English.
4. **Verify:** `pnpm exec tsc --noEmit` should be clean.
5. **Test in the browser:** the new language appears in the header dropdown automatically.

---

## 7. What *not* to translate

Some strings must stay in their original language:

- **Token symbols:** `GLW`, `GCTL`, `sGCTL`, `USDC`, `USDG`, `ETH`.
- **Chain names:** `Ethereum Mainnet`, `Sepolia`, `Base` (proper nouns).
- **Proper names:** `David Vorick`, `Vik Kalghatgi`, `Glow Labs`, `defined.fi`, `Discord`.
- **Terms of Service legal body** (`components/tos-dialog.tsx`): the expanded TOS text is the content the user's wallet cryptographically signs. A translated version would produce a different hash and break signature verification. We intentionally only translate the dialog **chrome** (title, intro, button labels, error messages) and leave the legal body English-only.
- **Article titles on glow.org/blog** when they link to an English-only page — we **do** translate the blog-featured widget's copy, but the article itself lives on glow.org.
- **Developer-facing strings:** `console.error` messages, Sentry tags, error names, API endpoints, telemetry event names. These are never user-visible.
- **Numeric locale formatting:** we deliberately use `en-US` number formatting (`1,234.56`) for monetary values across all languages for consistency with on-chain data displays. Dates use the user's selected locale via `getBcp47(lang)` in the ambassador dashboard date helpers.

---

## 8. Verifying a change

Fast path (types only):
```bash
pnpm exec tsc --noEmit
```
Ignore errors in test files (`__tests__/**`) — those are pre-existing and unrelated. Only errors in `lib/i18n/**` and any component file you touched should concern you.

Full path (visual):
```bash
pnpm dev
# open http://localhost:3000
# toggle language via the globe icon in the header (desktop) or the mobile drawer
# click through the changed pages
```

---

## 9. Korean style choices (for reviewers)

We've settled on a few conventions in the current KO translation. Reviewers should match these unless there's a reason to deviate:

- **Register:** 존댓말 (polite form). Endings like `-세요`, `-습니다`, `-해 주세요`.
- **Token names:** English (`GLW`, `GCTL`). Never transliterate.
- **Dollar amounts:** keep the `$` symbol, don't translate to `달러`.
- **"Week N":** `N주`. "Weeks" (duration): `N주 동안`.
- **"Delegate" (noun):** 위임. "Delegation": 위임.
- **"Miner":** 마이너 (loanword). Preferred over 채굴자 because it matches the on-chain product name.
- **"Glow Points":** 글로우 포인트.
- **"Glow Worth":** Glow 자산.
- **"Rank":** 순위. "Top N%": 상위 N%.

When in doubt, search for an existing key with similar meaning and match its style.

---

## 10. Gotchas

- **`use client` boundary:** every component that calls `useLang()` must be a client component (starts with `"use client"`). Server components render in English by default since the provider lives on the client.
- **Localized date formatting:** if you add a new date display, use `getBcp47(lang)` from `@/lib/i18n` instead of hardcoding `"en-US"`. Existing helpers in `app/ambassador/kol-dashboard.tsx` show the pattern.
- **Storage key migration:** the provider migrates `ambassador-dashboard-lang` → `glow-lang` on first load. If you're debugging a stale preference, clear both keys in localStorage.
- **Prefix/suffix collapse:** if you split a sentence into prefix + `<span>` + suffix and one part is empty in a given language, leave an empty string rather than `undefined`. TypeScript is stricter about `undefined` shapes.
- **ES/ZH were removed:** earlier commits scaffolded Spanish and Chinese stubs that spread from English. We removed them to focus on the EN/KO polish pass. See Section 6 above to add them back properly when needed — it's a documented, <1 hour mechanical task.

---

## 11. Who to ask

- **Translation questions (style, terminology):** the team member who owns the launch in that region, or reach out in `#app-i18n` on Discord.
- **Engineering questions (where does this string render? how do I wire it up?):** any frontend engineer on the app team. The patterns in `lib/i18n/` are intentionally small and readable.
- **Legal review (TOS changes):** Glow Labs legal — do **not** ship changes to `tos-dialog.tsx` legal body text without review.
