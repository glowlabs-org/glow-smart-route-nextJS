import { NextRequest, NextResponse } from "next/server";
import type { AuctionApplication } from "@/hooks/hub-listings";
import {
  applyLocalSponsorListingOverrides,
  isLocalMinerLaunchpadDuplicate,
  isSponsorListingVisibleAndOpen,
} from "@/utils/sponsor-listings-overrides";
import { isLocalMinerLaunchOverrideEnabled } from "@/utils/nextTuesdayET";

export const runtime = "nodejs";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

function copyHeader(
  source: Headers,
  target: Headers,
  name: string,
): void {
  const value = source.get(name);
  if (value) target.set(name, value);
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

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

export async function GET(request: NextRequest) {
  try {
    const inboundUrl = new URL(request.url);
    const requestedType = inboundUrl.searchParams.get("type");
    const includeFilledRequested =
      inboundUrl.searchParams.get("includeFilled") === "true";
    const isLaunchpadRequest =
      requestedType === null || requestedType === "launchpad";
    const shouldUseMiningCenterLocalOverride =
      requestedType === "mining-center" && isLocalMinerLaunchOverrideEnabled();
    const forwardUrl = new URL(
      `${getHubUrl()}/applications/sponsor-listings-applications`,
    );

    for (const [key, value] of inboundUrl.searchParams.entries()) {
      if (
        shouldUseMiningCenterLocalOverride &&
        key === "includeFilled" &&
        value !== "true"
      ) {
        continue;
      }
      forwardUrl.searchParams.append(key, value);
    }

    if (shouldUseMiningCenterLocalOverride && !includeFilledRequested) {
      forwardUrl.searchParams.set("includeFilled", "true");
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

    let applications =
      applyLocalSponsorListingOverrides(
        (await response.json()) as AuctionApplication[],
      );

    if (isLaunchpadRequest && isLocalMinerLaunchOverrideEnabled()) {
      applications = applications.filter(
        (application) => !isLocalMinerLaunchpadDuplicate(application),
      );
    }

    if (shouldUseMiningCenterLocalOverride && !includeFilledRequested) {
      applications = applications.filter((application) =>
        isSponsorListingVisibleAndOpen(application),
      );
    }

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
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
