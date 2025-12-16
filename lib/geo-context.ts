import { NextRequest } from "next/server";

export interface GeoContext {
  geo_country: string | null;
  geo_region: string | null;
}

export function getGeoContextFromRequest(
  request: NextRequest
): GeoContext | undefined {
  const geo = (request as any).geo as
    | { country?: string; region?: string }
    | undefined;

  const country =
    geo?.country ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-vercel-ip-country-code") ||
    null;

  const region =
    geo?.region ||
    request.headers.get("x-vercel-ip-country-region") ||
    request.headers.get("x-vercel-ip-country-region-code") ||
    null;

  if (!country && !region) return undefined;
  return {
    geo_country: country,
    geo_region: region,
  };
}


