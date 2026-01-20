function getHubUrl(): string {
  // IMPORTANT: use direct access so Next can inline NEXT_PUBLIC_* on the client.
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value)
    throw new Error("Environment variable NEXT_PUBLIC_HUB_URL is not set");
  return value;
}

export interface HubGetOptions<T> {
  params?: Record<string, string | number | boolean | null | undefined>;
  notFound?: T;
  init?: RequestInit;
}

function buildHubUrl(
  path: string,
  params?: HubGetOptions<unknown>["params"]
): string {
  const base = getHubUrl();
  const url = new URL(path, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function hubGet<T>(
  path: string,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);

  try {
    const res = await fetch(url, options.init);

    if (res.status === 404 && "notFound" in options)
      return options.notFound as T;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub GET ${path} failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function hubPost<T>(
  path: string,
  body: unknown,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);

  try {
    const res = await fetch(url, {
      ...options.init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.init?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub POST ${path} failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function hubPut<T>(
  path: string,
  body: unknown,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);

  try {
    const res = await fetch(url, {
      ...options.init,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options.init?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub PUT ${path} failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}
