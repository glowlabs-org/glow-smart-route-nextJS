import "server-only";

const DEFAULT_CONTROL_API_URL = "https://api-prod-34ce.up.railway.app";

export function getControlApiUrl(): string {
  return process.env.NEXT_PUBLIC_CONTROL_API_URL || DEFAULT_CONTROL_API_URL;
}

export async function fetchControlJson<T>(
  path: string,
  options?: { revalidate?: number }
): Promise<T> {
  const response = await fetch(`${getControlApiUrl()}${path}`, {
    next: {
      revalidate: options?.revalidate ?? 60,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Control GET ${path} failed: ${response.status} - ${text}`);
  }

  return (await response.json()) as T;
}
