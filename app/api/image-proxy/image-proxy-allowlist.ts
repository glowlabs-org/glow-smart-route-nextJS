const EXACT_ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "lh3.googleusercontent.com",
  "silver-managerial-rook-988.mypinata.cloud",
]);

const SUFFIX_ALLOWED_HOSTS = [
  ".mypinata.cloud",
  ".r2.dev",
];

export function isAllowedRemoteImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (EXACT_ALLOWED_HOSTS.has(hostname)) return true;

    return SUFFIX_ALLOWED_HOSTS.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}
