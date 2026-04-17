import { NextRequest, NextResponse } from "next/server";
import type { AuctionApplication } from "@/hooks/hub-listings";
import { buildForwardHeaders } from "@/app/api/_shared/forward-headers";

export const runtime = "nodejs";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const inboundUrl = new URL(request.url);
    const forwardUrl = new URL(
      `${getHubUrl()}/applications/sponsor-listings-applications`,
    );

    for (const [key, value] of inboundUrl.searchParams.entries()) {
      forwardUrl.searchParams.append(key, value);
    }

    const response = await fetch(forwardUrl.toString(), {
      headers: buildForwardHeaders(request),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      const contentType =
        response.headers.get("content-type") ?? "application/json";

      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    const applications = (await response.json()) as AuctionApplication[];

    return NextResponse.json(applications, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
