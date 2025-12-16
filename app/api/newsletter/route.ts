import { NextRequest, NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/telemetry-server";

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
  const startedAt = Date.now();
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Check rate limit
    if (!checkRateLimit(ip)) {
      await trackServerEvent("api_newsletter_subscribe_rate_limited", {
        duration_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Parse request body
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== "string") {
      await trackServerEvent("api_newsletter_subscribe_invalid", {
        duration_ms: Date.now() - startedAt,
        reason: "email_required",
      });
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await trackServerEvent("api_newsletter_subscribe_invalid", {
        duration_ms: Date.now() - startedAt,
        reason: "invalid_email_format",
      });
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check Brevo configuration
    if (!BREVO_API_TOKEN) {
      console.error("Missing Brevo configuration (BREVO_API_TOKEN)");
      await trackServerEvent("api_newsletter_subscribe_error", {
        duration_ms: Date.now() - startedAt,
        stage: "missing_brevo_token",
      });
      return NextResponse.json(
        { error: "Newsletter service is not configured" },
        { status: 500 }
      );
    }

    await trackServerEvent("api_newsletter_subscribe_request", {
      duration_ms: Date.now() - startedAt,
      has_email: true,
    });

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
        await trackServerEvent("api_newsletter_subscribe_error", {
          duration_ms: Date.now() - startedAt,
          stage: "brevo_400",
          provider_status: response.status,
        });
        return NextResponse.json(
          { error: body?.message || "Invalid request" },
          { status: 400 }
        );
      }
      if (response.status === 401) {
        await trackServerEvent("api_newsletter_subscribe_error", {
          duration_ms: Date.now() - startedAt,
          stage: "brevo_401",
          provider_status: response.status,
        });
        return NextResponse.json(
          { error: "Authentication failed with newsletter provider" },
          { status: 502 }
        );
      }
      if (response.status === 425) {
        await trackServerEvent("api_newsletter_subscribe_error", {
          duration_ms: Date.now() - startedAt,
          stage: "brevo_425",
          provider_status: response.status,
        });
        return NextResponse.json(
          { error: "Please try again shortly" },
          { status: 503 }
        );
      }

      await trackServerEvent("api_newsletter_subscribe_error", {
        duration_ms: Date.now() - startedAt,
        stage: "brevo_unknown",
        provider_status: response.status,
      });
      return NextResponse.json(
        { error: body?.message || "Failed to subscribe. Please try again." },
        { status: 500 }
      );
    }

    await trackServerEvent("api_newsletter_subscribe_success", {
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      { message: "Successfully subscribed to newsletter" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Newsletter subscription error:", error);
    await trackServerEvent("api_newsletter_subscribe_error", {
      duration_ms: Date.now() - startedAt,
      stage: "exception",
      error_name: error instanceof Error ? error.name : "unknown",
    });

    return NextResponse.json(
      { error: "Failed to subscribe to newsletter. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      await trackServerEvent("api_newsletter_check_invalid", {
        duration_ms: Date.now() - startedAt,
        reason: "email_required",
      });
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await trackServerEvent("api_newsletter_check_invalid", {
        duration_ms: Date.now() - startedAt,
        reason: "invalid_email_format",
      });
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!BREVO_API_TOKEN) {
      await trackServerEvent("api_newsletter_check_error", {
        duration_ms: Date.now() - startedAt,
        stage: "missing_brevo_token",
      });
      return NextResponse.json(
        { error: "Newsletter service is not configured" },
        { status: 500 }
      );
    }

    await trackServerEvent("api_newsletter_check_request", {
      duration_ms: Date.now() - startedAt,
      has_email: true,
    });

    // Check if contact exists in Brevo
    const response = await fetch(
      `${BREVO_API_BASE}/contacts/${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "api-key": BREVO_API_TOKEN,
        },
      }
    );

    if (response.status === 404) {
      await trackServerEvent("api_newsletter_check_success", {
        duration_ms: Date.now() - startedAt,
        subscribed: false,
        provider_status: response.status,
      });
      return NextResponse.json({ subscribed: false }, { status: 200 });
    }

    if (!response.ok) {
      await trackServerEvent("api_newsletter_check_error", {
        duration_ms: Date.now() - startedAt,
        stage: "brevo_not_ok",
        provider_status: response.status,
      });
      return NextResponse.json({ subscribed: false }, { status: 200 });
    }

    const contact = await response.json();

    // Check if subscribed to list 8 and not blacklisted
    const isSubscribed =
      !contact.emailBlacklisted && contact.listIds?.includes(8);

    await trackServerEvent("api_newsletter_check_success", {
      duration_ms: Date.now() - startedAt,
      subscribed: isSubscribed,
      provider_status: response.status,
    });
    return NextResponse.json({ subscribed: isSubscribed }, { status: 200 });
  } catch (error: any) {
    console.error("Newsletter subscription check error:", error);
    await trackServerEvent("api_newsletter_check_error", {
      duration_ms: Date.now() - startedAt,
      stage: "exception",
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ subscribed: false }, { status: 200 });
  }
}
