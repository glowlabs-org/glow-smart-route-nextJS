import { NextRequest, NextResponse } from "next/server";
import { getGeoContextFromRequest } from "@/lib/geo-context";

export function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  const isDocumentRequest = accept.includes("text/html");
  if (!isDocumentRequest) return NextResponse.next();

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
