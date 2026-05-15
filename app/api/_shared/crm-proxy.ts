/**
 * Shared proxy helpers for the V2 points / impact / shop API routes.
 *
 * The V2 points, impact, and shop endpoints all live on the GCA CRM
 * backend (the same service the codebase calls "the hub" — see
 * `NEXT_PUBLIC_HUB_URL`). These route wrappers exist so the frontend
 * can (a) attach the cache behavior each endpoint needs and (b) keep a
 * single proxy seam if auth or rewriting is needed later.
 *
 * `GET` wrappers forward the incoming query string verbatim. `POST`
 * wrappers forward the JSON body. Upstream non-2xx responses are
 * passed through with their status and body so the client hooks can
 * surface typed errors (e.g. 409 INSUFFICIENT_POINTS).
 */
import { NextResponse, type NextRequest } from "next/server";

function crmBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value.replace(/\/+$/, "");
}

export interface CrmProxyGetOptions {
  /**
   * Value for the response `Cache-Control` header. Omit for `no-store`
   * (the safe default for per-wallet data).
   */
  cacheControl?: string;
}

/**
 * Proxy a GET to `<CRM>/<crmPath>`, forwarding the incoming query
 * string. `crmPath` must NOT include a leading slash.
 */
export async function proxyCrmGet(
  request: NextRequest,
  crmPath: string,
  options: CrmProxyGetOptions = {},
): Promise<NextResponse> {
  const incoming = new URL(request.url);
  const target = `${crmBaseUrl()}/${crmPath}${incoming.search}`;
  const cacheControl = options.cacheControl ?? "no-store";

  try {
    const upstream = await fetch(target, { cache: "no-store" });
    const text = await upstream.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Upstream returned non-JSON (e.g. a 502 HTML page). Surface a
      // structured error rather than crashing the route.
      return NextResponse.json(
        { error: `Upstream returned non-JSON (status ${upstream.status})` },
        { status: 502 },
      );
    }
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Proxy request failed",
      },
      { status: 502 },
    );
  }
}

/**
 * Proxy a POST to `<CRM>/<crmPath>`, forwarding the JSON request body.
 * Always `no-store`. `crmPath` must NOT include a leading slash.
 */
export async function proxyCrmPost(
  request: NextRequest,
  crmPath: string,
): Promise<NextResponse> {
  const target = `${crmBaseUrl()}/${crmPath}`;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read request body" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
      cache: "no-store",
    });
    const text = await upstream.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: `Upstream returned non-JSON (status ${upstream.status})` },
        { status: 502 },
      );
    }
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Proxy request failed",
      },
      { status: 502 },
    );
  }
}
