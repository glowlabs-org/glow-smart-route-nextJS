function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  } as Storage;
}

// Some wallet SDKs attempt to touch `localStorage` during SSR/SSG, which crashes in
// Node/Vercel where `localStorage` is not defined. Provide a safe, in-memory fallback.
if (typeof window === "undefined") {
  const g = globalThis as unknown as {
    localStorage?: Storage;
    sessionStorage?: Storage;
  };

  const needsStorage = (s: unknown) =>
    !s ||
    typeof (s as any).getItem !== "function" ||
    typeof (s as any).setItem !== "function" ||
    typeof (s as any).removeItem !== "function";

  if (needsStorage(g.localStorage)) g.localStorage = createInMemoryStorage();
  if (needsStorage(g.sessionStorage)) g.sessionStorage = createInMemoryStorage();
}


