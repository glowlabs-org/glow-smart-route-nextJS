import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute per IP

function getRateLimitKey(ip: string): string {
  return `newsletter:${ip}`;
}

function checkRateLimit(ip: string): boolean {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  const record = rateLimit.get(key);

  if (!record || now > record.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimit.entries()) {
    if (now > record.resetTime) {
      rateLimit.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

// Brevo configuration
const BREVO_API_TOKEN = process.env.BREVO_API_TOKEN;
const BREVO_API_BASE = "https://api.brevo.com/v3";

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Parse request body
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check Brevo configuration
    if (!BREVO_API_TOKEN) {
      console.error("Missing Brevo configuration (BREVO_API_TOKEN)");
      return NextResponse.json(
        { error: "Newsletter service is not configured" },
        { status: 500 }
      );
    }

    // Create or update the contact in Brevo (subscribe = not blacklisted)
    const response = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_TOKEN,
      },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        emailBlacklisted: false,
        listIds: [8],
      }),
    });

    // Attempt to parse body for error context when available
    let body: any = null;
    try {
      body = await response.json();
    } catch {}

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      if (response.status === 400) {
        return NextResponse.json(
          { error: body?.message || "Invalid request" },
          { status: 400 }
        );
      }
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Authentication failed with newsletter provider" },
          { status: 502 }
        );
      }
      if (response.status === 425) {
        return NextResponse.json(
          { error: "Please try again shortly" },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: body?.message || "Failed to subscribe. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Successfully subscribed to newsletter" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Newsletter subscription error:", error);

    return NextResponse.json(
      { error: "Failed to subscribe to newsletter. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
