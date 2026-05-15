/**
 * Client-side fetch helper for the V2 points / impact / shop endpoints.
 *
 * These hit the app-local Next.js API routes under `/api/points/*`,
 * `/api/points-shop/*`, `/api/impact/*` (which proxy the GCA CRM
 * backend). The proxy passes upstream status + body through verbatim,
 * so a non-2xx response carries the CRM's `{ error, code }` shape.
 * `V2ApiError` surfaces both so callers can branch on `code`
 * (e.g. `INSUFFICIENT_POINTS`, `SOLD_OUT`, `BAD_NONCE`).
 */

export class V2ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "V2ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new V2ApiError(
      res.status,
      undefined,
      `Unexpected non-JSON response (status ${res.status})`,
    );
  }
}

function throwIfError(res: Response, body: unknown): void {
  if (res.ok) return;
  const err = (body ?? {}) as { error?: string; code?: string };
  throw new V2ApiError(
    res.status,
    err.code,
    err.error ?? `Request failed with status ${res.status}`,
  );
}

export async function v2ApiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const body = await parseBody(res);
  throwIfError(res, body);
  return body as T;
}

export async function v2ApiPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseBody(res);
  throwIfError(res, body);
  return body as T;
}
