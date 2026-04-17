import type { NextRequest } from "next/server";

function copyHeader(source: Headers, target: Headers, name: string): void {
  const value = source.get(name);
  if (value) target.set(name, value);
}

export function buildForwardHeaders(
  request: Request | NextRequest,
  extraHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);

  copyHeader(request.headers, headers, "user-agent");
  copyHeader(request.headers, headers, "referer");
  copyHeader(request.headers, headers, "origin");
  copyHeader(request.headers, headers, "cf-connecting-ip");
  copyHeader(request.headers, headers, "x-forwarded-for");
  copyHeader(request.headers, headers, "x-real-ip");
  copyHeader(request.headers, headers, "x-vercel-ip-country");
  copyHeader(request.headers, headers, "x-vercel-ip-country-code");
  copyHeader(request.headers, headers, "x-vercel-ip-country-region");
  copyHeader(request.headers, headers, "x-vercel-ip-country-region-code");
  copyHeader(request.headers, headers, "x-vercel-ip-city");
  copyHeader(request.headers, headers, "x-vercel-ip-latitude");
  copyHeader(request.headers, headers, "x-vercel-ip-longitude");

  return headers;
}

