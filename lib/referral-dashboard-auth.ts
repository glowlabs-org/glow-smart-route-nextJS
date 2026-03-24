import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const REFERRAL_DASHBOARD_PASSWORD_ENV =
  "REFERRAL_DASHBOARD_PASSWORD" as const;
export const REFERRAL_DASHBOARD_AUTH_COOKIE =
  "glow_referral_dashboard_auth" as const;

function hashReferralDashboardPassword(password: string) {
  return crypto
    .createHash("sha256")
    .update(`referral-dashboard:${password}`)
    .digest("hex");
}

function safeEqualStrings(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBuffer = encoder.encode(a);
  const bBuffer = encoder.encode(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function getReferralDashboardConfiguredPassword() {
  const password = process.env[REFERRAL_DASHBOARD_PASSWORD_ENV];
  return typeof password === "string" && password.length > 0 ? password : null;
}

export function isReferralDashboardPasswordConfigured() {
  return getReferralDashboardConfiguredPassword() !== null;
}

export function isValidReferralDashboardPassword(password: string) {
  const configuredPassword = getReferralDashboardConfiguredPassword();
  if (!configuredPassword) return false;

  return safeEqualStrings(password, configuredPassword);
}

export function createReferralDashboardAuthCookieValue() {
  const configuredPassword = getReferralDashboardConfiguredPassword();
  if (!configuredPassword) return null;

  return hashReferralDashboardPassword(configuredPassword);
}

export async function isReferralDashboardAuthorized() {
  const cookieStore = await cookies();
  const cookieValue =
    cookieStore.get(REFERRAL_DASHBOARD_AUTH_COOKIE)?.value ?? null;
  const expectedValue = createReferralDashboardAuthCookieValue();

  if (!cookieValue || !expectedValue) return false;

  return safeEqualStrings(cookieValue, expectedValue);
}

export function isReferralDashboardRequestAuthorized(request: NextRequest) {
  const cookieValue =
    request.cookies.get(REFERRAL_DASHBOARD_AUTH_COOKIE)?.value ?? null;
  const expectedValue = createReferralDashboardAuthCookieValue();

  if (!cookieValue || !expectedValue) return false;

  return safeEqualStrings(cookieValue, expectedValue);
}

export function createReferralDashboardUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized referral dashboard access" },
    { status: 401 }
  );
}
