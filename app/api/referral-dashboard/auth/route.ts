import { NextRequest, NextResponse } from "next/server";
import {
  REFERRAL_DASHBOARD_AUTH_COOKIE,
  REFERRAL_DASHBOARD_PASSWORD_ENV,
  createReferralDashboardAuthCookieValue,
  isValidReferralDashboardPassword,
  isReferralDashboardPasswordConfigured,
} from "@/lib/referral-dashboard-auth";

export async function POST(request: NextRequest) {
  try {
    if (!isReferralDashboardPasswordConfigured()) {
      return NextResponse.json(
        {
          error: `Missing ${REFERRAL_DASHBOARD_PASSWORD_ENV} configuration`,
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim() ?? "";

    if (!password || !isValidReferralDashboardPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const cookieValue = createReferralDashboardAuthCookieValue();
    if (!cookieValue) {
      return NextResponse.json(
        {
          error: `Missing ${REFERRAL_DASHBOARD_PASSWORD_ENV} configuration`,
        },
        { status: 503 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: REFERRAL_DASHBOARD_AUTH_COOKIE,
      value: cookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error("Error authenticating referral dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
