import { NextRequest, NextResponse } from "next/server";
import { getGeoContextFromRequest } from "@/lib/geo-context";

// Regex for referral landing path /r/<code>, where <code> is a URL-safe slug.
const REFERRAL_PATH = /^\/r\/([a-zA-Z0-9_-]+)\/?$/;

export function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  const isDocumentRequest = accept.includes("text/html");
  if (!isDocumentRequest) return NextResponse.next();

  // KOL / referral attribution: ensure every /r/<code> landing carries UTM
  // params so Umami's UTM + Attribution reports show per-KOL conversions.
  // One-time redirect on first hit; no-op on subsequent requests.
  const refMatch = request.nextUrl.pathname.match(REFERRAL_PATH);
  if (refMatch && !request.nextUrl.searchParams.has("utm_source")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("utm_source", refMatch[1]);
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "kol");
    return NextResponse.redirect(url);
  }

  const geo = getGeoContextFromRequest(request);
  const country = geo?.geo_country || null;
  const region = geo?.geo_region || null;

  const existingCountry = request.cookies.get("geo_country")?.value || null;
  const existingRegion = request.cookies.get("geo_region")?.value || null;

  const shouldSetCountry = !!country && country !== existingCountry;
  const shouldSetRegion = !!region && region !== existingRegion;

  if (!shouldSetCountry && !shouldSetRegion) return NextResponse.next();

  const response = NextResponse.next();
  if (shouldSetCountry) {
    response.cookies.set("geo_country", country, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
  }

  if (shouldSetRegion) {
    response.cookies.set("geo_region", region, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
